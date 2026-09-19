/**
 * Meda Live — Realtime session configuration (pure, no I/O).
 *
 * Extracted from routes/medaRealtime.js so request validation and the response
 * gating decision are testable without a network or a credential. The route
 * stays the only place that talks to the provider.
 *
 * ── Two session modes ───────────────────────────────────────────────────────
 *  interpretation  patientLanguage !== practiceLanguage — the live
 *                  interpreter. Unchanged instructions, voice and VAD.
 *  transcription   patientLanguage === practiceLanguage — no translation at
 *                  all. The model never answers and never speaks; only the
 *                  transcription model runs. Derived from the language pair,
 *                  never hardcoded to one language.
 *
 * ── Why responses can be client-gated ───────────────────────────────────────
 * With `create_response: true` the model answers — out loud — the moment VAD
 * closes a segment, before anyone has looked at what was said. A neighbour's
 * phone call in a third language was therefore spoken into the room first and
 * filtered in the UI afterwards.
 *
 * `create_response: false` turns that around: the client receives the
 * transcript, runs its deterministic checks (speaker binding, allowed
 * languages) and only then sends `response.create`. Rejected segments are
 * removed from the model's context with `conversation.item.delete`, so they
 * cannot colour later turns either.
 *
 * MEDA_REALTIME_GATED_RESPONSES=false restores the previous server-driven
 * behaviour exactly, as an operational rollback if the added transcript wait is
 * judged too slow in the field.
 *
 * ── Backward compatibility (PWA cache, App Store / Play Store builds) ───────
 * Gating is OPT-IN per request (`clientGating: true`). A client built before
 * this change never sends response.create; if the server gated its session
 * anyway, that client would silently stop translating. Installed native apps
 * and service-worker-cached web clients lag behind the server, so an old
 * client must keep getting the old, server-driven session.
 */

/** ISO 639-1 codes accepted by the transcription model. */
export const SUPPORTED_REALTIME_LANGUAGES = Object.freeze([
  'de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru',
  'ar', 'tr', 'ro', 'hr', 'uk', 'vi', 'zh', 'fa', 'sr', 'cs', 'sk',
]);

const SUPPORTED_SET = new Set(SUPPORTED_REALTIME_LANGUAGES);

export const MEDA_SESSION_MODES = Object.freeze({
  INTERPRETATION: 'interpretation',
  TRANSCRIPTION: 'transcription',
});

/** Who decides when the model answers. */
export const RESPONSE_GATING = Object.freeze({
  /** The client sends response.create after its checks pass. */
  CLIENT: 'client',
  /** Server VAD answers immediately — the pre-gating behaviour. */
  SERVER: 'server',
  /** Nobody: the session never answers (transcription). */
  NONE: 'none',
});

/**
 * Validates the request and derives the session mode from the language pair.
 * The mode is never taken on the client's word alone: a transcription request
 * with two different languages, or an interpretation request with the same
 * language twice, is refused rather than silently reinterpreted. An old client
 * that sends no mode keeps its old answer for the same language twice.
 *
 * @param {{ patientLanguage?: unknown, practiceLanguage?: unknown, mode?: unknown, clientGating?: unknown }} body
 * @returns {{ ok: true, mode: string, patientLanguage: string, practiceLanguage: string, clientGating: boolean }
 *          | { ok: false, error: string }}
 */
export function parseMedaSessionRequest(body) {
  const { patientLanguage, practiceLanguage, mode } = body ?? {};
  // Strict boolean: only a client that knows how to send response.create opts in.
  const clientGating = body?.clientGating === true;

  if (typeof patientLanguage !== 'string' || typeof practiceLanguage !== 'string') {
    return { ok: false, error: 'invalid_input' };
  }
  if (!SUPPORTED_SET.has(patientLanguage) || !SUPPORTED_SET.has(practiceLanguage)) {
    return { ok: false, error: 'unsupported_language' };
  }

  const sameLanguage = patientLanguage === practiceLanguage;
  const requested = mode === undefined || mode === null || mode === ''
    ? MEDA_SESSION_MODES.INTERPRETATION
    : mode;

  if (requested === MEDA_SESSION_MODES.TRANSCRIPTION) {
    if (!sameLanguage) return { ok: false, error: 'transcription_requires_same_language' };
    return { ok: true, mode: MEDA_SESSION_MODES.TRANSCRIPTION, patientLanguage, practiceLanguage, clientGating };
  }
  if (requested === MEDA_SESSION_MODES.INTERPRETATION) {
    if (sameLanguage) return { ok: false, error: 'interpretation_requires_two_languages' };
    return { ok: true, mode: MEDA_SESSION_MODES.INTERPRETATION, patientLanguage, practiceLanguage, clientGating };
  }
  return { ok: false, error: 'invalid_mode' };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean} true unless the operator explicitly rolled back.
 */
export function isClientResponseGatingEnabled(env = process.env) {
  const raw = String(env?.MEDA_REALTIME_GATED_RESPONSES ?? '').trim().toLowerCase();
  return !(raw === 'false' || raw === '0');
}

/** Instructions for a transcription session — a guard, not a feature. */
export const TRANSCRIPTION_SESSION_INSTRUCTIONS =
  'Diese Sitzung dient ausschließlich der Live-Transkription. ' +
  'Erzeuge niemals eine Antwort, Übersetzung, Zusammenfassung oder Sprachausgabe.';

/**
 * Builds the `session` object for client_secrets.create.
 *
 * @param {{
 *   mode?: string,
 *   clientGating?: boolean,
 *   instructions: string,
 *   model: string,
 *   transcriptionModel: string,
 *   voice: string,
 *   silenceMs: number,
 *   env?: NodeJS.ProcessEnv,
 * }} input
 * @returns {{ session: object, responseGating: string }}
 */
export function buildMedaRealtimeSession({
  mode = MEDA_SESSION_MODES.INTERPRETATION,
  clientGating = false,
  instructions,
  model,
  transcriptionModel,
  voice,
  silenceMs,
  env = process.env,
}) {
  const isTranscription = mode === MEDA_SESSION_MODES.TRANSCRIPTION;
  // Transcription ignores the rollback switch: it must never produce a response.
  const responseGating = isTranscription
    ? RESPONSE_GATING.NONE
    : (clientGating && isClientResponseGatingEnabled(env)
      ? RESPONSE_GATING.CLIENT
      : RESPONSE_GATING.SERVER);

  const session = {
    type: 'realtime',
    model,
    instructions: isTranscription ? TRANSCRIPTION_SESSION_INSTRUCTIONS : instructions,
    max_output_tokens: 'inf',
    // Text only for transcription: even a stray response could never be spoken.
    output_modalities: isTranscription ? ['text'] : ['audio'],
    audio: {
      input: {
        // No fixed input language on purpose: forcing one would make the
        // transcription model render foreign speech AS that language, which is
        // exactly what the language check has to be able to see and reject.
        transcription: { model: transcriptionModel },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 200,
          silence_duration_ms: silenceMs,
          create_response: responseGating === RESPONSE_GATING.SERVER,
          interrupt_response: !isTranscription,
        },
      },
      output: { voice },
    },
  };

  return { session, responseGating };
}
