/**
 * Read-aloud policy for the Pre-Visit preparation.
 *
 * ── What this path is ───────────────────────────────────────────────────────
 * `POST /api/previsit/audio/speak` has one client: the Pre-Visit audio toolbar,
 * the same component as the dictation button. It reads the current preparation
 * question back to the patient. The flow is reachable as a guest through a
 * practice's QR code, so the listener may have no account at all — the page
 * passes a qrToken to the toolbar, which is how we know rather than assume.
 *
 * ── Why its own gate ────────────────────────────────────────────────────────
 * Not the Pre-Visit input gate: that approves sending a patient's recorded
 * voice to a recognition provider, and this sends text to a synthesis provider.
 * Not the symptom read-aloud gate either: same technique, different people —
 * that one is a signed-in patient in their own account, this one can be a guest
 * of a practice who has no relationship with this product.
 *
 * ── What was here before ────────────────────────────────────────────────────
 * No authentication, no flag, no own credentials. A 1200-character limit and an
 * IP rate limit were the only bounds, and the shared OPENAI_API_KEY was the
 * only thing that had to be set.
 */

import {
  SPEECH_VOICES,
  unexpectedFields,
} from "../speechOutput/speechAudioFormat.js";

/**
 * The bound on one read-aloud request.
 *
 * Twelve hundred characters is what the endpoint already enforced and what the
 * client already slices to, so it is a measured product ceiling rather than a
 * number carried over from another feature — a preparation question read aloud
 * is a paragraph, not a document.
 */
export const MAX_PREVISIT_SPEECH_CHARS = 1200;

/** The only fields a caller may send. Anything else is refused. */
export const PREVISIT_SPEECH_FIELDS = Object.freeze(["text", "language", "qrToken"]);

export const PREVISIT_SPEECH_ERRORS = Object.freeze({
  FEATURE_DISABLED: "previsit_speech_disabled",
  PROVIDER_NOT_CONFIGURED: "previsit_speech_provider_not_configured",
  PROVIDER_FAILED: "previsit_speech_failed",
  NOT_AUTHORIZED: "not_authorized",
  TEXT_REQUIRED: "text_required",
  TEXT_TOO_LONG: "text_too_long",
  UNEXPECTED_FIELD: "unexpected_field",
  AUDIO_MALFORMED: "previsit_speech_failed",
});

export class PreVisitSpeechError extends Error {
  /**
   * @param {string} code one of PREVISIT_SPEECH_ERRORS
   * @param {object} [details] operational metadata — never the text to be spoken
   */
  constructor(code, details = {}) {
    super(code);
    this.name = "PreVisitSpeechError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Validates the request body and returns only what may be transmitted.
 *
 * Note what is absent from the return value: `language` is accepted from the
 * client, checked for shape, and then deliberately not passed on. The endpoint
 * has always ignored it — synthesis follows the script of the text itself — and
 * a field that changes nothing is a field the provider does not need. `qrToken`
 * is read by the authorization step and never travels either.
 *
 * @param {unknown} body
 * @returns {{ text: string, voice: string }}
 */
export function assertUsablePreVisitSpeechRequest(body) {
  const extra = unexpectedFields(body, PREVISIT_SPEECH_FIELDS);
  if (extra.length > 0) {
    throw new PreVisitSpeechError(PREVISIT_SPEECH_ERRORS.UNEXPECTED_FIELD, { fields: extra });
  }

  const raw = body?.text != null ? String(body.text) : "";
  // Length before trim: padding a payload with whitespace must not be a way
  // past the ceiling.
  if (raw.length > MAX_PREVISIT_SPEECH_CHARS) {
    throw new PreVisitSpeechError(PREVISIT_SPEECH_ERRORS.TEXT_TOO_LONG, {
      chars: raw.length,
      max: MAX_PREVISIT_SPEECH_CHARS,
    });
  }
  const text = raw.trim();
  if (!text) throw new PreVisitSpeechError(PREVISIT_SPEECH_ERRORS.TEXT_REQUIRED);

  return { text, voice: SPEECH_VOICES[0] };
}
