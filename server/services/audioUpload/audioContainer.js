/**
 * What an audio container actually looks like on disk.
 *
 * Facts about file formats, not policy about who may send them. Two features
 * now accept recordings — patient dictation into a message, and voice input in
 * the symptom modules — and both need to answer the same question: does this
 * payload look like the format it says it is?
 *
 * That question has one answer, so it lives in one place. Everything ABOUT the
 * two features stays apart: their limits, their gates, their providers and
 * their errors are all their own, and nothing here can be used to reach any of
 * them. Sharing a byte pattern is not sharing an approval.
 *
 * ── What this is, and is not ────────────────────────────────────────────────
 * A sanity check. It stops a mislabelled or plainly wrong upload from reaching
 * a paid provider. It does not decode, does not validate the stream, and proves
 * nothing about what the file contains beyond its first few bytes.
 */
import { signatureMatches } from "../../utils/fileSignature.js";

/** Containers a browser's MediaRecorder actually produces. */
export const AUDIO_CONTAINER_MIME = Object.freeze([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

/**
 * The container a declared type names, with codec parameters stripped.
 *
 * A browser announces `audio/webm;codecs=opus`; the container is what matters.
 *
 * @param {unknown} declared
 * @returns {string} normalized MIME, or "" when it names nothing known
 */
export function normalizeAudioMime(declared) {
  const mime = String(declared ?? "").split(";")[0].trim().toLowerCase();
  return AUDIO_CONTAINER_MIME.includes(mime) ? mime : "";
}

/**
 * Do the first bytes match the container the payload claims to be?
 *
 * @param {Buffer} buffer
 * @param {string} mime already normalized
 * @returns {boolean} false when it does not, or when nothing is known about it
 */
export function audioContainerMatches(buffer, mime) {
  // The byte patterns used to live here. They now live in one table shared with
  // every other upload path — utils/fileSignature.js — because four separate
  // copies of "what a file looks like" is four chances for them to drift apart,
  // and because the paths with NO copy stayed invisible while each feature kept
  // its own. What stays here is the audio-specific part: only a container this
  // feature accepts counts, whatever else the shared table happens to know.
  if (!AUDIO_CONTAINER_MIME.includes(mime)) return false;
  return signatureMatches(buffer, mime);
}
