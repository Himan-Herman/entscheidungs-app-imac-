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

/** Containers a browser's MediaRecorder actually produces. */
export const AUDIO_CONTAINER_MIME = Object.freeze([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

const CONTAINER_SIGNATURES = Object.freeze({
  /** EBML — WebM and Matroska. */
  "audio/webm": { offset: 0, patterns: [[0x1a, 0x45, 0xdf, 0xa3]] },
  /** "OggS". */
  "audio/ogg": { offset: 0, patterns: [[0x4f, 0x67, 0x67, 0x53]] },
  /** ISO base media — "ftyp" sits after the four-byte box length. */
  "audio/mp4": { offset: 4, patterns: [[0x66, 0x74, 0x79, 0x70]] },
  /** An MPEG frame sync, or an ID3 tag in front of one. */
  "audio/mpeg": { offset: 0, patterns: [[0xff, 0xfb], [0xff, 0xf3], [0x49, 0x44, 0x33]] },
  /** "RIFF". */
  "audio/wav": { offset: 0, patterns: [[0x52, 0x49, 0x46, 0x46]] },
});

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
  const signature = CONTAINER_SIGNATURES[mime];
  if (!signature) return false;

  const { offset, patterns } = signature;
  return patterns.some((bytes) => {
    if (!buffer || buffer.length < offset + bytes.length) return false;
    return bytes.every((byte, i) => buffer[offset + i] === byte);
  });
}
