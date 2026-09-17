/**
 * What an uploaded file actually is, as opposed to what it says it is.
 *
 * ── The problem this solves ─────────────────────────────────────────────────
 * `file.mimetype` in a multipart upload is the Content-Type the CLIENT wrote
 * into the request. It is not derived from the bytes and nothing verifies it,
 * so an allowlist built on it answers a question the sender also gets to
 * answer. Renaming a payload and declaring `image/png` satisfies every
 * `fileFilter` in this codebase — those filters keep honest clients honest and
 * do nothing else.
 *
 * ── One table, not several ──────────────────────────────────────────────────
 * There were four separate byte checks before this file: audio containers for
 * the three voice features, a PDF header on the doctor-contact upload, an image
 * sniff on the avatar route, and a third PDF header inside the document
 * translation preflight. Four tables are four chances to disagree, and the
 * paths WITHOUT one — the practice logo, the practice document, vaccination
 * scans — stayed invisible precisely because no single place listed what was
 * covered.
 *
 * So the format facts live here, once. Policy does not: which types a feature
 * accepts, how large, from whom, and behind which consent all remain with that
 * feature. Sharing a byte pattern is not sharing an approval.
 *
 * ── What this is, and is not ────────────────────────────────────────────────
 * A sanity check on the opening bytes. It stops a mislabelled or plainly wrong
 * payload before it is stored or sent to a provider. It does not parse, does
 * not decode, and proves nothing about the rest of the file: a valid PNG header
 * in front of arbitrary content still passes. That is what antivirus and
 * sandboxing are for, and neither is in scope here.
 */

/**
 * The bytes each type begins with.
 *
 * `offset` is where to look; `patterns` is the set of openings that count,
 * because several formats have more than one legitimate first sequence.
 */
const SIGNATURES = Object.freeze({
  /* ── documents ───────────────────────────────────────────────────────── */
  /** "%PDF". */
  "application/pdf": { offset: 0, patterns: [[0x25, 0x50, 0x44, 0x46]] },
  /** Legacy Word: the OLE compound-document header. */
  "application/msword": {
    offset: 0,
    patterns: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  },
  /** .docx is a ZIP: "PK" then the local-file, empty, or spanned marker. */
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    offset: 0,
    patterns: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
      [0x50, 0x4b, 0x07, 0x08],
    ],
  },

  /* ── images ──────────────────────────────────────────────────────────── */
  /** The eight-byte PNG signature. */
  "image/png": { offset: 0, patterns: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  /** JPEG start-of-image. */
  "image/jpeg": { offset: 0, patterns: [[0xff, 0xd8, 0xff]] },
  /** RIFF container; the WEBP tag at offset 8 is checked below. */
  "image/webp": { offset: 0, patterns: [[0x52, 0x49, 0x46, 0x46]] },

  /* ── audio containers ────────────────────────────────────────────────── */
  /** EBML — WebM and Matroska. */
  "audio/webm": { offset: 0, patterns: [[0x1a, 0x45, 0xdf, 0xa3]] },
  /** "OggS". */
  "audio/ogg": { offset: 0, patterns: [[0x4f, 0x67, 0x67, 0x53]] },
  /** ISO base media — "ftyp" sits after the four-byte box length. */
  "audio/mp4": { offset: 4, patterns: [[0x66, 0x74, 0x79, 0x70]] },
  /** An MPEG frame sync, or an ID3 tag in front of one. */
  "audio/mpeg": {
    offset: 0,
    patterns: [
      [0xff, 0xfb],
      [0xff, 0xf3],
      [0x49, 0x44, 0x33],
    ],
  },
  /** RIFF container; the WAVE tag at offset 8 is checked below. */
  "audio/wav": { offset: 0, patterns: [[0x52, 0x49, 0x46, 0x46]] },
});

/**
 * RIFF is a container, not a format: `image/webp` and `audio/wav` open with the
 * same four bytes and are told apart by the tag at offset 8. Without this a WAV
 * would pass as a WebP, and an image upload would accept audio.
 */
const RIFF_TAGS = Object.freeze({
  "image/webp": [0x57, 0x45, 0x42, 0x50], // "WEBP"
  "audio/wav": [0x57, 0x41, 0x56, 0x45], // "WAVE"
});

/** Every type this file can speak about. */
export const KNOWN_SIGNATURE_MIMES = Object.freeze(Object.keys(SIGNATURES));

/**
 * The type a declared value names, with parameters stripped and case folded.
 *
 * A browser announces `audio/webm;codecs=opus` and some clients append a
 * charset; the type is what matters.
 *
 * @param {unknown} declared
 * @returns {string} the bare type, or "" when it names nothing
 */
export function normalizeMime(declared) {
  return String(declared ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

/**
 * @param {Buffer} buffer
 * @param {number} offset
 * @param {number[]} bytes
 */
function matchesAt(buffer, offset, bytes) {
  if (!buffer || buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/**
 * Do the opening bytes match the type the payload claims to be?
 *
 * A type this file knows nothing about returns false. An unknown type is not a
 * pass: callers decide which types they accept, and this only answers whether
 * the claim is consistent with what arrived.
 *
 * @param {Buffer} buffer
 * @param {string} declaredMime
 * @returns {boolean}
 */
export function signatureMatches(buffer, declaredMime) {
  const mime = normalizeMime(declaredMime);
  const signature = SIGNATURES[mime];
  if (!signature) return false;

  if (!signature.patterns.some((bytes) => matchesAt(buffer, signature.offset, bytes))) {
    return false;
  }
  const riffTag = RIFF_TAGS[mime];
  return riffTag ? matchesAt(buffer, 8, riffTag) : true;
}

/** Thrown when a payload is not what it says it is. */
export class FileSignatureError extends Error {
  /**
   * @param {string} code
   * @param {object} [details]
   */
  constructor(code, details = {}) {
    super(code);
    this.name = "FileSignatureError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Refuses anything whose bytes disagree with its declared type.
 *
 * Deliberately says nothing about what the payload looked like instead. That
 * answer would tell whoever sent it how close they got, and a legitimate client
 * has no use for it — it knows what it uploaded.
 *
 * @param {Buffer} buffer the payload as received
 * @param {string} declaredMime the client's Content-Type for this part
 * @param {Iterable<string>} allowed the types THIS feature accepts
 * @throws {FileSignatureError} `file_type_not_allowed` or `file_type_mismatch`
 */
export function assertDeclaredTypeMatchesBytes(buffer, declaredMime, allowed) {
  const mime = normalizeMime(declaredMime);
  const accepted = allowed instanceof Set ? allowed : new Set(allowed);

  if (!accepted.has(mime)) {
    throw new FileSignatureError("file_type_not_allowed", { declared: mime });
  }
  if (!signatureMatches(buffer, mime)) {
    throw new FileSignatureError("file_type_mismatch", { declared: mime });
  }
}

/**
 * A filename safe to show a person, derived from one we were handed.
 *
 * The original is metadata and nothing more: it is never a path, never part of
 * a storage key, and never joined onto a directory — storage keys are generated
 * server-side. This exists so that the name shown in a document list cannot
 * carry a traversal sequence, a control character, or a length that breaks a
 * layout.
 *
 * @param {unknown} original
 * @param {string} [fallback]
 * @returns {string}
 */
export function safeDisplayFilename(original, fallback = "upload") {
  const raw = String(original ?? "");
  // Only the last segment can be a filename; anything before it was a path,
  // whichever separator was used.
  const lastSegment = raw.split(/[/\\]/).pop() ?? "";
  const cleaned = lastSegment
    // Control characters, including the NUL that truncates a C string.
    .replace(/[\u0000-\u001f\u007f]/g, "")
    // A leading dot would make a hidden file, and "." and ".." are not names.
    .replace(/^\.+/, "")
    .trim();

  if (!cleaned) return fallback;
  return cleaned.length > 180 ? cleaned.slice(0, 180) : cleaned;
}
