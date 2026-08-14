/**
 * Critical token masking — prevention instead of detection.
 *
 * A translation model that turns "5 mg" into "50 mg" produces something that
 * looks completely normal. Detecting that afterwards means comparing two texts
 * in two different languages and hoping the comparison is right.
 *
 * So the values never reach the model. Every medically critical token is
 * replaced by an opaque marker before translation and restored afterwards:
 *
 *   "Ramipril 5 mg, 1-0-0"  ->  "Ramipril ⟦DOSE_001⟧, ⟦SCHEDULE_002⟧"
 *
 * The model translates the language around the markers. It cannot alter a dose
 * it never sees. That converts a whole class of failures from "hopefully
 * detected" into "structurally impossible".
 *
 * ── The digit-residue invariant ─────────────────────────────────────────────
 * Masking is designed so that after it runs, the masked text contains NO digits
 * outside markers. That gives a very strong downstream check: if translated
 * text contains a digit outside a marker, the model invented a number. See
 * maskedOutputValidation.js.
 *
 * ── Atomic units ────────────────────────────────────────────────────────────
 * Tokens are matched as whole medical units, not as parts. "0,0–0,5 mg/dl" is
 * ONE reference-range token, not two numbers and a unit, so a model cannot
 * reorder or split the pieces.
 *
 * ── Honest limits ───────────────────────────────────────────────────────────
 * Numbers written as words ("fünf Milligramm") are not maskable and are not
 * claimed to be. Everything numeric is covered; spelled-out quantities are not.
 */

/** Marker delimiters — mathematical white brackets, effectively absent from clinical prose. */
const MARK_OPEN = "⟦";
const MARK_CLOSE = "⟧";

/**
 * Marker ordinals are encoded in LETTERS, not digits.
 *
 * This is load-bearing, not cosmetic. Masking runs as a sequence of passes over
 * the same string, so a marker emitted by an early pass is still visible to a
 * later one. With a numeric ordinal, the final catch-all NUM pass would mask
 * the digits inside "⟦DOSE_001⟧" and destroy the marker it had just created.
 *
 * Letter ordinals also make the digit-residue invariant exact: a fully masked
 * text contains no digits at all, so any digit in a model response is
 * unambiguously invented material.
 */
const ORDINAL_WIDTH = 4;

/** Matches any well-formed marker. */
export const MARKER_PATTERN = new RegExp(
  `${MARK_OPEN}([A-Z]+)_([A-Z]{${ORDINAL_WIDTH}})${MARK_CLOSE}`,
  "g",
);

/**
 * Base-26 ordinal: 1 -> AAAB, 26 -> AAAZ, 27 -> AABA.
 * Four letters cover 456,976 tokens, far beyond MAX_SEGMENTS.
 * @param {number} n
 */
function ordinal(n) {
  let out = "";
  let value = n;
  for (let i = 0; i < ORDINAL_WIDTH; i += 1) {
    out = String.fromCharCode(65 + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out;
}

/**
 * Units that may terminate a dose or measurement. Longest alternatives first so
 * "mg/dl" wins over "mg". Ordering inside this string is load-bearing.
 */
// "%" is deliberately NOT a unit here — percentages are their own atomic kind
// so that "50 %" is labelled PERCENT rather than an anonymous dose.
const UNIT = String.raw`(?:mg\/dl|mg\/l|g\/dl|g\/l|µg\/l|mcg\/l|mmol\/l|mval\/l|U\/l|U\/ml|IE\/l|IU\/l|ng\/ml|pg\/ml|µmol\/l|Gpt\/l|Tpt\/l|mmHg|kPa|mval|mmol|µmol|nmol|kcal|kJ|mg|µg|mcg|ng|pg|kg|g|dl|ml|µl|l|IE|IU|°C|°F|\/min|bpm|mm|cm|m)`;

/** A number with either decimal separator, optional thousands dots or spaces. */
const NUMBER = String.raw`\d+(?:[.,]\d+)?`;

/** En dash, em dash, hyphen or " bis " — all used for ranges in German reports. */
const RANGE_SEP = String.raw`(?:\s*[-–—]\s*|\s+bis\s+)`;

/**
 * Token kinds in match order. ORDER IS SIGNIFICANT — the first pattern that
 * matches a position wins, so more specific constructs must precede the
 * constructs they contain:
 *
 *   DATE before SCHEDULE  : "2026-08-12" would otherwise read as a 1-0-0 schedule
 *   SCHEDULE before REFRANGE : "1-0-0" would otherwise read as the range "1-0"
 *   REFRANGE before DOSE  : "0,0–0,5 mg/dl" would otherwise yield only "0,5 mg/dl"
 *   DOSE before NUM       : "5 mg" must stay one atomic unit
 *   PERCENT before NUM    : "50 %" must stay one atomic unit
 */
const TOKEN_KINDS = [
  {
    kind: "DATE",
    // 12.08.2026 · 12.8.26 · 2026-08-12 · 12/08/2026
    re: new RegExp(
      String.raw`\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4})\b`,
      "g",
    ),
  },
  {
    kind: "TIME",
    // 14:30 · 14:30:15 · 14:30 Uhr
    re: new RegExp(String.raw`\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*Uhr)?`, "g"),
  },
  {
    kind: "SCHEDULE",
    // 1-0-0 · 1-1-1-1 · 0,5-0-0,5
    // Requires three or four parts, so a two-part reference range cannot match.
    re: new RegExp(String.raw`\b${NUMBER}(?:\s*[-–—]\s*${NUMBER}){2,3}\b`, "g"),
  },
  {
    kind: "REFRANGE",
    // 0,0–0,5 mg/dl · 70 - 110 mg/dl · 3,5 bis 5,1 mmol/l · (0,0-0,5)
    re: new RegExp(String.raw`\b${NUMBER}${RANGE_SEP}${NUMBER}(?:\s*${UNIT})?`, "g"),
  },
  {
    kind: "DOSE",
    // 5 mg · 1,5 mg/dl · 500mg · 36,6 °C
    re: new RegExp(String.raw`\b${NUMBER}\s*${UNIT}`, "g"),
  },
  {
    kind: "PERCENT",
    re: new RegExp(String.raw`\b${NUMBER}\s*%`, "g"),
  },
  {
    kind: "CODE",
    // ICD-10-style codes only: one letter, two digits, optional .n / .nn.
    // Deliberately narrow — "eindeutig erkennbar" or not masked at all.
    re: new RegExp(String.raw`\b[A-Z]\d{2}(?:\.\d{1,2})?\b`, "g"),
  },
  {
    kind: "NUM",
    // Whatever numeric material is left. This is what guarantees the
    // digit-residue invariant.
    re: new RegExp(String.raw`\d+(?:[.,]\d+)*`, "g"),
  },
];

/**
 * @typedef {object} MaskToken
 * @property {string} marker    the literal ⟦KIND_NNN⟧ string
 * @property {string} kind
 * @property {string} original  the exact source substring, restored verbatim
 * @property {number} segmentIndex
 */

/**
 * @typedef {object} MaskedSegment
 * @property {number} index
 * @property {string} kind
 * @property {string} text      masked text
 */

/**
 * Mask an ordered segment list.
 *
 * Markers are numbered document-wide, so a marker identifies exactly one
 * original value no matter which segment it appears in.
 *
 * @param {{ index: number, kind: string, text: string }[]} segments
 * @returns {{ segments: MaskedSegment[], tokens: MaskToken[], tokenMap: Map<string, MaskToken> }}
 */
export function maskSegments(segments) {
  const tokens = [];
  const tokenMap = new Map();
  const counter = { n: 0 };

  const maskedSegments = (segments || []).map((seg) => ({
    index: seg.index,
    kind: seg.kind,
    text: maskOne(String(seg.text ?? ""), seg.index, tokens, tokenMap, counter),
  }));

  return { segments: maskedSegments, tokens, tokenMap };
}

/**
 * @param {string} text
 * @param {number} segmentIndex
 * @param {MaskToken[]} tokens
 * @param {Map<string, MaskToken>} tokenMap
 * @param {{ n: number }} counter
 */
function maskOne(text, segmentIndex, tokens, tokenMap, counter) {
  let out = text;

  // Stray delimiter characters already present in the source are masked FIRST,
  // as ordinary tokens. A document containing "⟦DOSE_AAAB⟧" would otherwise
  // collide with a marker we mint moments later, and the validator would treat
  // smuggled text as one of its own.
  //
  // Masking them rather than rewriting them keeps the transformation lossless:
  // replacing "⟦" with "(" would silently alter what the document said.
  const emit = (kind, match) => {
    counter.n += 1;
    const marker = `${MARK_OPEN}${kind}_${ordinal(counter.n)}${MARK_CLOSE}`;
    const token = { marker, kind, original: match, segmentIndex };
    tokens.push(token);
    tokenMap.set(marker, token);
    return marker;
  };

  out = out.replace(/[⟦⟧]/g, (match) => emit("BRACKET", match));

  for (const { kind, re } of TOKEN_KINDS) {
    re.lastIndex = 0;
    out = out.replace(re, (match) => emit(kind, match));
  }

  return out;
}

/**
 * Restore original values.
 *
 * Call ONLY after validateMaskedOutput has passed — unmasking unvalidated text
 * would paper over a missing or duplicated marker instead of failing.
 *
 * @param {string} maskedText
 * @param {Map<string, MaskToken>} tokenMap
 * @returns {string}
 */
export function unmaskText(maskedText, tokenMap) {
  MARKER_PATTERN.lastIndex = 0;
  return String(maskedText).replace(MARKER_PATTERN, (marker) => {
    const token = tokenMap.get(marker);
    // Unknown markers are rejected by validation, so this branch is unreachable
    // for validated input. Returning the marker verbatim keeps the failure
    // visible rather than silently deleting content.
    return token ? token.original : marker;
  });
}

/**
 * List markers in a string, in order of appearance.
 * @param {string} text
 * @returns {string[]}
 */
export function findMarkers(text) {
  MARKER_PATTERN.lastIndex = 0;
  return String(text).match(MARKER_PATTERN) || [];
}

/**
 * Text with all markers removed — used by the digit-residue check.
 * @param {string} text
 */
export function stripMarkers(text) {
  MARKER_PATTERN.lastIndex = 0;
  return String(text).replace(MARKER_PATTERN, " ");
}

/**
 * Digits appearing outside any marker.
 *
 * On masked source this must be empty (the invariant). On model output, any
 * match means a number was invented.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function findUnmaskedDigits(text) {
  return stripMarkers(text).match(/\d+(?:[.,]\d+)*/g) || [];
}
