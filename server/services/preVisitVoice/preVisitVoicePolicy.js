/**
 * Voice input policy for the Pre-Visit preparation.
 *
 * ── What this path is ───────────────────────────────────────────────────────
 * One client: the Pre-Visit audio toolbar. A patient speaks about what has been
 * happening to them, so the practice has it before the appointment. The flow is
 * deliberately usable without an account — a practice hands out a QR code and
 * the patient prepares as a guest — which is a product decision, not an
 * oversight, and this phase preserves it.
 *
 * ── Why its own limits ──────────────────────────────────────────────────────
 * Not copied from the other two audio features. A message to a practice is a
 * couple of sentences and the symptom modules cap recording at sixty seconds in
 * the browser; a pre-visit preparation is someone recounting a history, and
 * capping it as tightly would cut people off mid-sentence about their own
 * health. Three minutes is generous for that and still a bound — the route
 * accepted ten megabytes and no duration limit at all before this phase.
 */

import {
  AUDIO_CONTAINER_MIME,
  audioContainerMatches,
  normalizeAudioMime,
} from "../audioUpload/audioContainer.js";

export const PREVISIT_VOICE_MIME = AUDIO_CONTAINER_MIME;

/**
 * The bound on one recording.
 *
 * Three minutes of speech is several hundred words — more than any pre-visit
 * answer observed in the product, and far below what an unbounded upload could
 * be. Six megabytes covers that in every container the browsers produce,
 * including the inefficient ones.
 */
export const MAX_PREVISIT_VOICE_SECONDS = 180;
export const MAX_PREVISIT_VOICE_BYTES = 6 * 1024 * 1024;

/** Too small to be speech — an empty recorder flush. */
export const MIN_PREVISIT_VOICE_BYTES = 512;

export const PREVISIT_VOICE_ERRORS = Object.freeze({
  FEATURE_DISABLED: "previsit_voice_disabled",
  PROVIDER_NOT_CONFIGURED: "previsit_voice_provider_not_configured",
  PROVIDER_FAILED: "transcription_failed",
  NOT_AUTHORIZED: "not_authorized",
  NO_AUDIO: "no_audio",
  AUDIO_TOO_LARGE: "too_large",
  AUDIO_TOO_SHORT: "invalid_audio",
  UNSUPPORTED_AUDIO_TYPE: "unsupported_type",
  AUDIO_MALFORMED: "invalid_audio",
  TRANSCRIPT_REJECTED: "transcription_failed",
});

export class PreVisitVoiceError extends Error {
  /**
   * @param {string} code one of PREVISIT_VOICE_ERRORS
   * @param {object} [details] operational metadata — never audio, never transcript
   */
  constructor(code, details = {}) {
    super(code);
    this.name = "PreVisitVoiceError";
    this.code = code;
    this.details = details;
  }
}

/**
 * The whole payload check, cheapest first.
 *
 * @param {{ buffer: Buffer, mimetype: string }} file
 * @returns {string} the normalized container type
 */
export function assertUsablePreVisitVoice(file) {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.NO_AUDIO);
  }
  if (file.buffer.length > MAX_PREVISIT_VOICE_BYTES) {
    throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.AUDIO_TOO_LARGE, {
      bytes: file.buffer.length,
      max: MAX_PREVISIT_VOICE_BYTES,
    });
  }
  if (file.buffer.length < MIN_PREVISIT_VOICE_BYTES) {
    throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.AUDIO_TOO_SHORT, {
      bytes: file.buffer.length,
    });
  }

  const mime = normalizeAudioMime(file.mimetype);
  if (!mime) {
    throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.UNSUPPORTED_AUDIO_TYPE, {
      declared: String(file.mimetype ?? "").split(";")[0].trim().toLowerCase() || null,
      supported: [...PREVISIT_VOICE_MIME],
    });
  }
  if (!audioContainerMatches(file.buffer, mime)) {
    throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.AUDIO_MALFORMED, { mime });
  }
  return mime;
}

/**
 * A language hint, or nothing.
 *
 * Free-form rather than an allowlist: unlike the messaging features, Pre-Visit
 * deliberately reaches far beyond the six interface languages — the whole point
 * is a patient preparing in the language they actually speak. Shape is checked,
 * membership is not.
 *
 * @param {unknown} requested
 * @returns {string | null}
 */
export function normalizeDictationLanguage(requested) {
  const raw = String(requested ?? "").trim().toLowerCase();
  if (!raw) return null;
  const match = /^([a-z]{2})(-[a-z]{2})?$/.exec(raw);
  return match ? match[1] : null;
}
