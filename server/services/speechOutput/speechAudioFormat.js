/**
 * Facts about the audio a speech provider hands back.
 *
 * ── Why this is shared and what it deliberately is not ──────────────────────
 * Two features read text aloud — the symptom modules and the Pre-Visit
 * preparation — and both need to know what a valid MP3 looks like and which
 * Content-Type describes it. Those are properties of the format, true no matter
 * who is speaking or why.
 *
 * What is NOT here: gates, credentials, hosts, limits, authorization. Sharing
 * any of those would mean approving one feature approves the other, which is
 * the exact inference these phases exist to remove. This module is the same
 * shape as `audioUpload/audioContainer.js` on the input side: format only.
 */

/** The one output format either feature asks for. */
export const SPEECH_OUTPUT_FORMAT = "mp3";

/**
 * The Content-Type the server sets itself.
 *
 * Set from this constant, never echoed from a provider response header — a
 * header we did not choose is a header we did not review.
 */
export const SPEECH_OUTPUT_MIME = "audio/mpeg";

/** Below this an "MP3" is a truncation or an error page, not speech. */
export const MIN_SPEECH_BYTES = 256;

/**
 * The internal voice vocabulary.
 *
 * Deliberately not provider voice names. A client that could name a provider
 * voice could name any provider feature reachable through that field, and the
 * names themselves would leak which provider is in use — which the product must
 * not do. Callers do not choose a voice at all today; this exists so that if
 * one ever does, the value it sends is one of ours.
 */
export const SPEECH_VOICES = Object.freeze(["neutral"]);

/**
 * Does this buffer plausibly contain MP3 audio?
 *
 * Either an ID3 tag or an MPEG frame sync. This is a sanity check on what came
 * back, not a decoder: it catches an error page, an empty body or a truncated
 * transfer being passed on to a patient's audio element as if it were speech.
 *
 * @param {Buffer | Uint8Array} buffer
 * @returns {boolean}
 */
export function looksLikeSpeechAudio(buffer) {
  if (!buffer || buffer.length < MIN_SPEECH_BYTES) return false;
  // "ID3"
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;
  // MPEG audio frame sync: 11 set bits.
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
  return false;
}

/**
 * Refuses a request body carrying fields this feature does not accept.
 *
 * An unknown field is not harmless: it is the shape every "just pass it
 * through" provider-option leak has taken. Refusing is cheap; the alternative
 * is discovering later that a caller could set something we never reviewed.
 *
 * @param {object} body
 * @param {string[]} allowed
 * @returns {string[]} the offending keys, empty when the body is clean
 */
export function unexpectedFields(body, allowed) {
  if (!body || typeof body !== "object") return [];
  return Object.keys(body).filter((key) => !allowed.includes(key));
}
