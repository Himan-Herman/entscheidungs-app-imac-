/**
 * Read-aloud policy for the patient's own symptom modules.
 *
 * ── What this path is ───────────────────────────────────────────────────────
 * `/api/tts` has exactly three clients, all of them the SpeakButton: the
 * symptom check, the body-region flow, and the chat beside an uploaded image.
 * In each one it reads back the assistant's reply about the patient's own
 * symptoms. All three pages sit behind ProtectedRoute, so the caller is always
 * a signed-in patient — established by looking, not assumed.
 *
 * ── Why its own gate rather than the symptom input gate ─────────────────────
 * ENABLE_SYMPTOM_VOICE_INPUT approves sending a patient's recorded voice to a
 * recognition provider. This path sends text to a synthesis provider. Same
 * product area, opposite direction, different processing, and an operator may
 * well want one without the other. Approving one must not silently approve the
 * other — that is the rule these phases exist to enforce, and it applies within
 * a feature area just as it does between them.
 *
 * ── What was here before ────────────────────────────────────────────────────
 * No authentication, no flag, no length limit, no own credentials: the endpoint
 * spoke whatever text it was handed, for anyone who could reach the server,
 * whenever OPENAI_API_KEY happened to be set.
 */

import {
  SPEECH_VOICES,
  unexpectedFields,
} from "../speechOutput/speechAudioFormat.js";

/**
 * The bound on one read-aloud request, and where the number comes from.
 *
 * Measured, not inherited: the prompts behind all three clients cap an
 * assistant turn at "max 2 sentences" or short plain language, so real payloads
 * are a couple of hundred characters. Twelve hundred is several times the
 * observed output and still a hard ceiling — the endpoint had none at all, and
 * an endpoint that speaks arbitrary text at the deployment's expense is a
 * text-to-speech API someone else can use for free.
 */
export const MAX_SYMPTOM_SPEECH_CHARS = 1200;

/** The only fields a caller may send. Anything else is refused. */
export const SYMPTOM_SPEECH_FIELDS = Object.freeze(["text"]);

export const SYMPTOM_SPEECH_ERRORS = Object.freeze({
  FEATURE_DISABLED: "symptom_speech_disabled",
  PROVIDER_NOT_CONFIGURED: "symptom_speech_provider_not_configured",
  PROVIDER_FAILED: "symptom_speech_failed",
  NOT_AUTHORIZED: "not_authorized",
  TEXT_REQUIRED: "text_required",
  TEXT_TOO_LONG: "text_too_long",
  UNEXPECTED_FIELD: "unexpected_field",
  AUDIO_MALFORMED: "symptom_speech_failed",
});

export class SymptomSpeechError extends Error {
  /**
   * @param {string} code one of SYMPTOM_SPEECH_ERRORS
   * @param {object} [details] operational metadata — never the text to be spoken
   */
  constructor(code, details = {}) {
    super(code);
    this.name = "SymptomSpeechError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Validates the request body and returns only what may be transmitted.
 *
 * @param {unknown} body
 * @returns {{ text: string, voice: string }}
 */
export function assertUsableSymptomSpeechRequest(body) {
  const extra = unexpectedFields(body, SYMPTOM_SPEECH_FIELDS);
  if (extra.length > 0) {
    throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.UNEXPECTED_FIELD, { fields: extra });
  }

  const raw = body?.text != null ? String(body.text) : "";
  // Length before trim: padding a payload with whitespace must not be a way
  // past the ceiling.
  if (raw.length > MAX_SYMPTOM_SPEECH_CHARS) {
    throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.TEXT_TOO_LONG, {
      chars: raw.length,
      max: MAX_SYMPTOM_SPEECH_CHARS,
    });
  }
  const text = raw.trim();
  if (!text) throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.TEXT_REQUIRED);

  // The caller does not choose a voice — there is no field for one, and this is
  // the internal name, never a provider's.
  return { text, voice: SPEECH_VOICES[0] };
}
