/**
 * Voice input policy for the patient's own symptom modules.
 *
 * ── What this path is ───────────────────────────────────────────────────────
 * `/api/transcribe` has exactly one client: the VoiceInput control, used in the
 * symptom check, the body-region flow, and beside an uploaded image. In all
 * three a patient dictates a description of their own symptoms into their own
 * session. That is the whole surface, established by looking rather than by
 * assuming — the inventory is in the phase report.
 *
 * ── Why it has its own limits ───────────────────────────────────────────────
 * Not because dictation into a message is different in kind, but because the
 * two features are approved separately and must be able to be tightened,
 * loosened or switched off separately. Sharing a limit would mean changing one
 * feature's bound changes the other's, and that is exactly the coupling this
 * phase exists to remove.
 */

import {
  AUDIO_CONTAINER_MIME,
  audioContainerMatches,
  normalizeAudioMime,
} from "../audioUpload/audioContainer.js";

export const SYMPTOM_VOICE_MIME = AUDIO_CONTAINER_MIME;

/**
 * The bound on one recording, and where the number comes from.
 *
 * The VoiceInput control stops recording after sixty seconds — that is in the
 * component, not a guess. Ninety seconds is therefore generous headroom for
 * anything the product actually produces, while being far below what an
 * unbounded upload could be. Two megabytes covers ninety seconds of Opus
 * several times over.
 *
 * Before this phase the limit was ten megabytes with no duration bound at all.
 */
export const MAX_SYMPTOM_VOICE_SECONDS = 90;
export const MAX_SYMPTOM_VOICE_BYTES = 2 * 1024 * 1024;

/** Too small to be speech — an empty recorder flush. */
export const MIN_SYMPTOM_VOICE_BYTES = 512;

export const SYMPTOM_VOICE_ERRORS = Object.freeze({
  FEATURE_DISABLED: "symptom_voice_disabled",
  PROVIDER_NOT_CONFIGURED: "symptom_voice_provider_not_configured",
  PROVIDER_FAILED: "symptom_voice_provider_failed",
  NO_AUDIO: "no_audio",
  AUDIO_TOO_LARGE: "audio_too_large",
  AUDIO_TOO_SHORT: "audio_too_short",
  UNSUPPORTED_AUDIO_TYPE: "unsupported_audio_type",
  AUDIO_MALFORMED: "audio_malformed",
  TRANSCRIPT_REJECTED: "transcript_rejected",
});

export class SymptomVoiceError extends Error {
  /**
   * @param {string} code one of SYMPTOM_VOICE_ERRORS
   * @param {object} [details] operational metadata — never audio, never transcript
   */
  constructor(code, details = {}) {
    super(code);
    this.name = "SymptomVoiceError";
    this.code = code;
    this.details = details;
  }
}

/**
 * The whole payload check, cheapest first.
 *
 * Size before structure, structure before anything that leaves the process, so
 * an oversized or mislabelled upload is refused without a provider seeing a
 * byte of it.
 *
 * @param {{ buffer: Buffer, mimetype: string }} file
 * @returns {string} the normalized container type
 */
export function assertUsableSymptomVoice(file) {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.NO_AUDIO);
  }
  if (file.buffer.length > MAX_SYMPTOM_VOICE_BYTES) {
    throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.AUDIO_TOO_LARGE, {
      bytes: file.buffer.length,
      max: MAX_SYMPTOM_VOICE_BYTES,
    });
  }
  if (file.buffer.length < MIN_SYMPTOM_VOICE_BYTES) {
    throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.AUDIO_TOO_SHORT, {
      bytes: file.buffer.length,
      min: MIN_SYMPTOM_VOICE_BYTES,
    });
  }

  const mime = normalizeAudioMime(file.mimetype);
  if (!mime) {
    throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.UNSUPPORTED_AUDIO_TYPE, {
      declared: String(file.mimetype ?? "").split(";")[0].trim().toLowerCase() || null,
      supported: [...SYMPTOM_VOICE_MIME],
    });
  }
  if (!audioContainerMatches(file.buffer, mime)) {
    throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.AUDIO_MALFORMED, { mime });
  }
  return mime;
}
