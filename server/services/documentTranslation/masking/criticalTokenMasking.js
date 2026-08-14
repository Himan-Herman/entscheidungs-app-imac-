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
 * ── Beyond numbers: names that must not change either ───────────────────────
 * Masking only the strength is not enough. "Ramipril ⟦DOSE_AAAB⟧" leaves the
 * drug name in the model's hands, and "Ramipril" -> "Lisinopril" would pass
 * every marker check while changing the medication. So a name standing
 * immediately before a strength is masked TOGETHER with it as one atomic
 * MEDICATION token, and curated abbreviations, substance names and WHO INN
 * stems are masked in their own right.
 *
 * ── Honest limits ───────────────────────────────────────────────────────────
 *   • Numbers written as words ("fünf Milligramm") are not maskable.
 *   • A drug name with NO strength nearby is protected only if it is on the
 *     curated list or carries an INN stem. A rare or misspelled substance
 *     written bare is NOT protected — this cannot be solved without a drug
 *     lexicon, and none is used here.
 *   • The MEDICATION rule requires a capitalised name, so a lowercase INN in an
 *     English source is covered only by the INN-stem rule.
 *   • Multi-word names ("Insulin glargin") are captured only up to the first
 *     word, together with the strength.
 * These are stated rather than engineered around, and each is pinned by a
 * KNOWN LIMIT test.
 */

import { buildPatientIdentifierPatterns } from "./patientIdentifierMasking.js";
import {
  ABBREVIATION_PATTERN_SOURCE,
  assertKindNamesAreParsable,
  DOSAGE_FORM_PATTERN_SOURCE,
  IDENTIFIER_PATTERNS,
  INN_STEM_PATTERN_SOURCE,
  PRODUCT_QUALIFIER_PATTERN_SOURCE,
  STRENGTH_UNIT_PATTERN_SOURCE,
  SUBSTANCE_NAME_PATTERN_SOURCE,
  WORD_DOSE_PATTERN_SOURCE,
  WORD_FREQUENCY_PATTERN_SOURCE,
} from "./medicalTokenLexicon.js";

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

/** A dosing schedule: 1-0-0, 1-1-1-1, 0,5-0-0,5. Three or four parts. */
const SCHEDULE_BODY = String.raw`${NUMBER}(?:\s*[-–—]\s*${NUMBER}){2,3}`;

/**
 * A medication name standing immediately before a strength.
 *
 * Capitalised because German writes substance and trade names that way, and the
 * rule has to stay narrow enough not to swallow ordinary sentence material.
 * Lowercase substance names (common in English sources) are covered by the INN
 * and curated-name rules instead — see the known limits below.
 */
const MEDICATION_NAME_HEAD = String.raw`[A-ZÄÖÜ][A-Za-z0-9ÄÖÜäöüß-]{1,40}`;

/**
 * Continuation tokens of a multi-part product name.
 *
 * Three shapes occur in German letters and each one carries meaning that must
 * not be separable from the head:
 *   "Insulin glargin"        lowercase INN qualifier — which insulin it is
 *   "Ramipril HEXAL"         manufacturer suffix — a different product
 *   "Metformin XR"           release qualifier — a different regimen
 *   "Amoxicillin/Clavulan…"  second active substance
 *
 * The lowercase branch requires four or more letters so German function words
 * ("von", "mit", "der") cannot be absorbed into a product name.
 */
const MEDICATION_NAME_TAIL =
  String.raw`(?:[\s/](?:[A-ZÄÖÜ][A-Za-z0-9ÄÖÜäöüß-]{1,40}|[a-zäöü][a-zäöüß]{3,30}|` +
  PRODUCT_QUALIFIER_PATTERN_SOURCE +
  String.raw`))`;

/** Full product name: a head plus up to two continuation tokens. */
const MEDICATION_NAME = String.raw`${MEDICATION_NAME_HEAD}${MEDICATION_NAME_TAIL}{0,2}`;

/**
 * Composite strength: "875/125 mg", "100 E/ml", "20 IE".
 * The slash form is one strength for a combination product, not two numbers.
 */
const STRENGTH = String.raw`${NUMBER}(?:\s*\/\s*${NUMBER})*\s*${STRENGTH_UNIT_PATTERN_SOURCE}`;

/**
 * Token kinds in match order. ORDER IS SIGNIFICANT — the first pattern that
 * matches a position wins, so more specific constructs must precede the
 * constructs they contain:
 *
 *   MEDICATION first      : "ASS 100 mg 1-0-0" must become ONE token, so it has
 *                           to run before ABBREV would claim "ASS" and before
 *                           DOSE would claim "100 mg"
 *   ABBREV before numbers : "HbA1c" and "SpO2" contain digits; the numeric
 *                           passes would otherwise shred them into "HbA⟦NUM⟧c"
 *   OPS before REFRANGE   : "5-820.00" would otherwise read as the range "5-820"
 *   DATE before SCHEDULE  : "2026-08-12" would otherwise read as a 1-0-0 schedule
 *   SCHEDULE before REFRANGE : "1-0-0" would otherwise read as the range "1-0"
 *   REFRANGE before DOSE  : "0,0–0,5 mg/dl" would otherwise yield only "0,5 mg/dl"
 *   DOSE before NUM       : "5 mg" must stay one atomic unit
 *   PERCENT before NUM    : "50 %" must stay one atomic unit
 */
const TOKEN_KINDS = [
  // Structured direct identifiers first: most contain digits and would
  // otherwise be shredded by the numeric passes, and none of them needs to
  // reach an external processor at all.
  ...IDENTIFIER_PATTERNS.filter((p) => p.kind !== "PHONE").map((p) => ({
    kind: p.kind,
    re: new RegExp(p.source, "g"),
  })),
  {
    kind: "MEDICATION",
    // "Ramipril 5 mg" · "ASS 100 mg 1-0-0" · "Insulin glargin 20 IE"
    // "Amoxicillin/Clavulansäure 875/125 mg" · "Ramipril HEXAL 5 mg Filmtabletten"
    //
    // The whole product identity becomes ONE opaque token: name (including a
    // second active substance, a manufacturer suffix or a release qualifier),
    // strength, dosage form and — when it follows directly — the dosing
    // schedule. The model cannot rename the drug, drop "XR", remove the second
    // substance or move a schedule, because it never sees any of them.
    //
    // The strength unit set excludes concentration and physical units, so
    // "CRP 1,5 mg/dl", "Kalium 4,2 mmol/l", "Gewicht 80 kg" and
    // "Temperatur 36,6 °C" are NOT read as medication lines.
    re: new RegExp(
      String.raw`${MEDICATION_NAME}\s+${STRENGTH}` +
        String.raw`(?:\s+${DOSAGE_FORM_PATTERN_SOURCE})?` +
        String.raw`(?:[\s,]+${SCHEDULE_BODY})?`,
      "g",
    ),
  },
  {
    kind: "PRODUCT",
    // A product identified by its device or dosage form rather than a strength:
    // "NovoRapid FlexPen", "Symbicort Turbohaler", "Ramipril Filmtabletten".
    // Neither word may be in any list, but the device word makes the phrase
    // recognisable as a medicinal product, and the name beside it is exactly
    // what must not change.
    re: new RegExp(
      String.raw`${MEDICATION_NAME_HEAD}(?:[\s/][A-Za-z0-9ÄÖÜäöüß-]{2,40}){0,2}\s+${DOSAGE_FORM_PATTERN_SOURCE}`,
      "g",
    ),
  },
  {
    kind: "WORDDOSE",
    // "fünf Milligramm" · "eine halbe Tablette" · "half a tablet"
    // Written-out doses carry the same information as numeric ones and no
    // numeric pattern can see them. Masked as whole phrases — the aim is that
    // the model cannot change them, not that we parse them into numbers.
    re: new RegExp(WORD_DOSE_PATTERN_SOURCE, "g"),
  },
  {
    kind: "WORDFREQ",
    // "zweimal täglich" · "twice daily"
    re: new RegExp(WORD_FREQUENCY_PATTERN_SOURCE, "g"),
  },
  {
    kind: "ABBREV",
    // Curated clinical abbreviations. Masked so they cannot be expanded,
    // translated or "corrected" — CRP must not become "C-reaktives Protein".
    re: new RegExp(ABBREVIATION_PATTERN_SOURCE, "g"),
  },
  {
    kind: "SUBSTANCE",
    // Curated substance/trade names appearing WITHOUT a strength, where the
    // structural MEDICATION rule cannot fire.
    re: new RegExp(SUBSTANCE_NAME_PATTERN_SOURCE, "g"),
  },
  {
    kind: "INN",
    // Words carrying a WHO INN stem (-pril, -olol, -sartan, -statin, ...).
    // Generalises past the curated list without needing a drug database.
    re: new RegExp(INN_STEM_PATTERN_SOURCE, "g"),
  },
  {
    kind: "OPS",
    // German procedure codes: 1-100 · 5-820.00 · 8-931
    re: new RegExp(String.raw`(?<![\w.-])\d-\d{3}(?:\.\d{1,2})?(?![\w.-])`, "g"),
  },
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
    // After DATE and TIME so an ISO date is not read as a phone number, and
    // before SCHEDULE/REFRANGE for real phone shapes. Its seven-digit floor
    // keeps "1-0-0" and "70 - 110" out.
    kind: "PHONE",
    re: new RegExp(
      IDENTIFIER_PATTERNS.find((p) => p.kind === "PHONE").source,
      "g",
    ),
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

// Fails at import time rather than silently producing markers that cannot be
// parsed back. A kind containing an underscore breaks the marker grammar.
assertKindNamesAreParsable(TOKEN_KINDS.map((t) => t.kind));

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
export function maskSegments(segments, options = {}) {
  const tokens = [];
  const tokenMap = new Map();
  const counter = { n: 0 };

  // Patient identifiers run BEFORE every generic pass. A name has to be claimed
  // whole; once "Mustermann" has been partly consumed by another rule there is
  // nothing left to match. They are passed in rather than looked up here so
  // this module stays free of database access.
  const patientPatterns = options.patientIdentity
    ? buildPatientIdentifierPatterns(options.patientIdentity)
    : [];
  assertKindNamesAreParsable(patientPatterns.map((p) => p.kind));

  const maskedSegments = (segments || []).map((seg) => ({
    index: seg.index,
    kind: seg.kind,
    text: maskOne(
      String(seg.text ?? ""),
      seg.index,
      tokens,
      tokenMap,
      counter,
      patientPatterns,
    ),
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
function maskOne(text, segmentIndex, tokens, tokenMap, counter, patientPatterns = []) {
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

  for (const { kind, re } of [...patientPatterns, ...TOKEN_KINDS]) {
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
 * Token kinds that mark a piece of text as clinical data rather than prose.
 *
 * Used by the PDF layout rules: a two-column structure carrying these is a
 * medication or results table, where reading across instead of down moves a
 * value to the wrong row. DATE and TIME are deliberately absent — a letterhead
 * with a right-aligned date is not clinical data.
 */
export const CLINICAL_TOKEN_KINDS = Object.freeze([
  "MEDICATION",
  "DOSE",
  "REFRANGE",
  "SCHEDULE",
  "SUBSTANCE",
  "INN",
  "ABBREV",
]);

/**
 * Whether a piece of text contains clinical data, decided by running the real
 * masking rules rather than by a second, divergent pattern set.
 *
 * @param {string} text
 * @param {readonly string[]} [kinds]
 * @returns {boolean}
 */
export function containsClinicalToken(text, kinds = CLINICAL_TOKEN_KINDS) {
  const wanted = new Set(kinds);
  const { tokens } = maskSegments([{ index: 0, kind: "probe", text: String(text ?? "") }]);
  return tokens.some((t) => wanted.has(t.kind));
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
