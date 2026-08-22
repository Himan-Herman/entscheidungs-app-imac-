/**
 * Dictation policy — what audio may be sent, how long, and in what form.
 *
 * Deny-by-default decisions made BEFORE any provider is involved. No I/O, no
 * database, no environment access.
 *
 * ── Why this is not the translation policy ──────────────────────────────────
 * Text translation decides about a message that already exists. Dictation
 * decides about a recording that will never become one: the result is a draft
 * in a text field, and the message — if there ever is one — is created later by
 * the person pressing send. Nothing here refers to a message id, because at
 * this point there is no message.
 *
 * ── What the masking chain cannot do here ───────────────────────────────────
 * Phases 4A and 4B protect doses and drug names by replacing them before the
 * text is transmitted. That is impossible for audio: the value is spoken, and
 * removing it would mean recognising it first — which is the very thing being
 * outsourced. So dictation has no equivalent guarantee, and the protection is
 * different in kind: the recording is bounded, transient, sent nowhere without
 * its own approval, and the result is shown to the speaker before it can go
 * anywhere at all.
 */

import { MESSAGE_TRANSLATION_TARGET_LOCALE_CODES } from "../../../shared/i18n/localeConfig.js";
import {
  AUDIO_CONTAINER_MIME,
  audioContainerMatches,
  normalizeAudioMime,
} from "../audioUpload/audioContainer.js";

/**
 * Container formats a browser actually produces.
 *
 * Taken from the shared list rather than restated: which byte pattern belongs
 * to which container is a fact about file formats, and two features asking the
 * same question should not be able to answer it differently. What stays here is
 * everything that is a DECISION — the limits, the languages, the errors — and
 * nothing about that list reaches this feature's gate.
 */
export const ALLOWED_AUDIO_MIME = AUDIO_CONTAINER_MIME;

/**
 * The longest dictation this accepts, and why this number.
 *
 * A chat message to a practice is a few sentences: "the pain is back since
 * Thursday, should I keep taking the tablet". Ninety seconds of speech is
 * already far more than that. The limit is not a judgement about how much
 * someone may say — it is a bound on how much audio can be produced by one
 * click, transmitted, and paid for. Anything longer is a different feature
 * (a consultation recording) with different questions attached, and this phase
 * deliberately does not build it.
 *
 * The byte limit follows from the duration rather than being picked separately:
 * Opus at the bitrate browsers use for speech runs about 4 KB per second, so
 * 90 seconds is well under 2 MB. Four megabytes leaves generous room for the
 * less efficient containers (WAV especially) without leaving room for a file
 * that is not a short dictation at all.
 */
export const MAX_DICTATION_SECONDS = 90;
export const MAX_DICTATION_BYTES = 4 * 1024 * 1024;

/** Too small to be speech — an empty recorder flush, not a dictation. */
export const MIN_DICTATION_BYTES = 512;

/**
 * Languages a dictation may be declared as.
 *
 * The same derived set the rest of the messaging feature uses, so a language
 * the product speaks can be dictated in and one it does not cannot. The value
 * is a hint to the recogniser, never a decision about anything: an actor is not
 * authorized differently because of the language they spoke.
 */
export const DICTATION_LANGUAGES = MESSAGE_TRANSLATION_TARGET_LOCALE_CODES;
const DICTATION_LANGUAGE_SET = new Set(DICTATION_LANGUAGES);

export const MESSAGE_STT_ERRORS = Object.freeze({
  FEATURE_DISABLED: "message_stt_disabled",
  PROVIDER_NOT_CONFIGURED: "message_stt_provider_not_configured",
  PROVIDER_FAILED: "message_stt_provider_failed",
  NO_AUDIO: "no_audio",
  AUDIO_TOO_LARGE: "audio_too_large",
  AUDIO_TOO_SHORT: "audio_too_short",
  UNSUPPORTED_AUDIO_TYPE: "unsupported_audio_type",
  AUDIO_MALFORMED: "audio_malformed",
  UNSUPPORTED_LANGUAGE: "unsupported_dictation_language",
  TRANSCRIPT_REJECTED: "transcript_rejected",
});

export class MessageSttError extends Error {
  /**
   * @param {string} code one of MESSAGE_STT_ERRORS
   * @param {object} [details] operational metadata — never audio, never transcript
   */
  constructor(code, details = {}) {
    super(code);
    this.name = "MessageSttError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Normalizes a requested dictation language, or refuses it.
 *
 * Absent is allowed and means "let the recogniser decide" — a convenience, not
 * a guarantee, and nothing downstream depends on the answer.
 *
 * @param {unknown} requested
 * @returns {string | null}
 */
export function assertDictationLanguage(requested) {
  const code = String(requested ?? "").trim().toLowerCase();
  if (!code) return null;
  if (!DICTATION_LANGUAGE_SET.has(code)) {
    throw new MessageSttError(MESSAGE_STT_ERRORS.UNSUPPORTED_LANGUAGE, { requested: code });
  }
  return code;
}

/**
 * Normalizes a declared MIME type, or refuses it.
 *
 * Codec parameters are stripped: a browser announces
 * `audio/webm;codecs=opus`, and the container is what matters here.
 *
 * @param {unknown} declared
 */
export function assertSupportedAudioType(declared) {
  const mime = normalizeAudioMime(declared);
  if (!mime) {
    throw new MessageSttError(MESSAGE_STT_ERRORS.UNSUPPORTED_AUDIO_TYPE, {
      declared: String(declared ?? "").split(";")[0].trim().toLowerCase() || null,
      supported: [...ALLOWED_AUDIO_MIME],
    });
  }
  return mime;
}

/**
 * Does the payload look like the container it claims to be?
 *
 * @param {Buffer} buffer
 * @param {string} mime already normalized
 */
export function assertContainerMatches(buffer, mime) {
  if (!audioContainerMatches(buffer, mime)) {
    throw new MessageSttError(MESSAGE_STT_ERRORS.AUDIO_MALFORMED, { mime });
  }
  return true;
}

/**
 * The whole payload check, in the order that costs least first.
 *
 * Size before structure, structure before anything that leaves the process:
 * an oversized or mislabelled upload is refused without a provider ever seeing
 * a byte of it.
 *
 * @param {{ buffer: Buffer, mimetype: string }} file
 */
export function assertUsableDictation(file) {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new MessageSttError(MESSAGE_STT_ERRORS.NO_AUDIO);
  }
  if (file.buffer.length > MAX_DICTATION_BYTES) {
    throw new MessageSttError(MESSAGE_STT_ERRORS.AUDIO_TOO_LARGE, {
      bytes: file.buffer.length,
      max: MAX_DICTATION_BYTES,
    });
  }
  if (file.buffer.length < MIN_DICTATION_BYTES) {
    throw new MessageSttError(MESSAGE_STT_ERRORS.AUDIO_TOO_SHORT, {
      bytes: file.buffer.length,
      min: MIN_DICTATION_BYTES,
    });
  }
  const mime = assertSupportedAudioType(file.mimetype);
  assertContainerMatches(file.buffer, mime);
  return mime;
}
