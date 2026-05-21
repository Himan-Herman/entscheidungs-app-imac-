/**
 * Medical Interpreter — terminology / negation / number preservation (Phase 2.4).
 * Lightweight heuristics only — no second model call.
 */

const UNCERTAIN_PREFIX = /^\[UNCERTAIN\]\s*/i;

/** @type {{ type: string, re: RegExp }[]} */
const ANCHOR_PATTERNS = [
  {
    type: "dosage_unit",
    re: /\b\d+([.,]\d+)?\s*(mg|ml|mcg|µg|μg|g|kg|cm|mm|mmol\/l|mmhg|°c|°f|%|iu|units?)\b/gi,
  },
  {
    type: "bp_like",
    re: /\b\d{2,3}\s*\/\s*\d{2,3}\b/g,
  },
  {
    type: "frequency",
    re: /\b\d+\s*(x|×|mal)\s*(pro\s+tag|daily|täglich|per\s+day|weekly|wöchentlich)\b/gi,
  },
  { type: "date", re: /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g },
  { type: "time", re: /\b\d{1,2}:\d{2}(\s*(am|pm|Uhr))?\b/gi },
  { type: "quoted", re: /"[^"]{1,120}"/g },
  { type: "quoted_alt", re: /«[^»]{1,120}»/g },
  {
    type: "allergy",
    re: /\b(allerg(y|ies|ic)|allergie(n)?|allergisch)\b[^.]{0,50}/gi,
  },
];

const UNCLEAR_SOURCE_PATTERNS = [
  /\b(unclear|inaudible|unverständlich|nicht verständlich|unintelligible)\b/i,
  /\b(mumble|mumbled|undeutlich)\b/i,
  /\[?\s*\.{3,}\s*\]?/,
  /\?\?+/,
  /\b(i\s+)?(can't|cannot)\s+(hear|understand)\b/i,
  /\b(ich\s+)?(kann|verstehe)\s+nicht\b/i,
];

/** Negation cues by broad language group (heuristic). */
const NEGATION_BY_LANG = {
  en: [/\bno\b/i, /\bnot\b/i, /\bnever\b/i, /\bwithout\b/i, /\bdon'?t\b/i, /\bdoesn'?t\b/i, /\bdidn'?t\b/i],
  de: [/\bkein\b/i, /\bkeine\b/i, /\bkeinen\b/i, /\bnicht\b/i, /\bnie\b/i, /\bohne\b/i, /\bnein\b/i],
  fr: [/\bpas\b/i, /\bjamais\b/i, /\bsans\b/i, /\bnon\b/i],
  es: [/\bno\b/i, /\bnunca\b/i, /\bsin\b/i, /\bno\s+es\b/i],
  it: [/\bnon\b/i, /\bmai\b/i, /\bsenza\b/i],
  ru: [/\bне\b/i, /\bнет\b/i, /\bникогда\b/i, /\bбез\b/i],
  ar: [/\bلا\b/i, /\bليس\b/i, /\bبدون\b/i],
  tr: [/\bdeğil\b/i, /\byok\b/i, /\bhiç\b/i],
};

const DEFAULT_NEGATION = [
  ...NEGATION_BY_LANG.en,
  ...NEGATION_BY_LANG.de,
  /\bno\b/i,
  /\bnot\b/i,
  /\bnicht\b/i,
];

const MAX_ANCHORS = 24;

/**
 * @param {string} sourceLang
 * @param {string} targetLang
 */
export function buildTranslationDirection(sourceLang, targetLang) {
  return `${String(sourceLang || "").toLowerCase()}->${String(targetLang || "").toLowerCase()}`;
}

/**
 * @param {string} text
 * @returns {{ id: string, value: string, type: string }[]}
 */
export function extractProtectedAnchors(text) {
  const source = String(text || "");
  const seen = new Set();
  /** @type {{ id: string, value: string, type: string }[]} */
  const anchors = [];

  for (const { type, re } of ANCHOR_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) != null && anchors.length < MAX_ANCHORS) {
      const value = match[0].trim();
      const key = value.toLowerCase();
      if (value.length < 2 || seen.has(key)) continue;
      seen.add(key);
      anchors.push({
        id: `A${anchors.length + 1}`,
        value,
        type,
      });
    }
  }

  return anchors;
}

/**
 * @param {{ id: string, value: string, type: string }[]} anchors
 */
export function formatAnchorsForPrompt(anchors) {
  if (!anchors.length) return "";
  const lines = anchors.map((a) => `- [${a.id}] ${a.value} (${a.type})`);
  return `Protected segments — copy numbers, units, medication/allergy names, dates, and quoted wording exactly; do not change negation meaning:\n${lines.join("\n")}`;
}

/**
 * @param {string} raw
 */
export function stripUncertainPrefix(raw) {
  let text = String(raw ?? "").trim();
  const uncertain = UNCERTAIN_PREFIX.test(text);
  if (uncertain) text = text.replace(UNCERTAIN_PREFIX, "").trim();
  return { text, uncertain };
}

/**
 * @param {string} text
 */
export function sourceSoundsUnclear(text) {
  const s = String(text || "");
  return UNCLEAR_SOURCE_PATTERNS.some((re) => re.test(s));
}

/**
 * @param {string} langCode
 */
function negationPatternsFor(langCode) {
  const base = String(langCode || "")
    .toLowerCase()
    .split(/[-_]/)[0];
  return NEGATION_BY_LANG[base] || DEFAULT_NEGATION;
}

/**
 * @param {string} text
 * @param {string} langCode
 */
export function textHasNegation(text, langCode) {
  const patterns = negationPatternsFor(langCode);
  return patterns.some((re) => re.test(String(text || "")));
}

/**
 * @param {string} sourceText
 * @param {string} translatedText
 * @param {string} sourceLang
 * @param {string} targetLang
 */
export function negationPreservationRisk(sourceText, translatedText, sourceLang, targetLang) {
  const source = String(sourceText || "");
  const translated = String(translatedText || "");
  if (!textHasNegation(source, sourceLang)) return false;
  return !textHasNegation(translated, targetLang);
}

/**
 * Normalize number token for fuzzy match (1,5 vs 1.5).
 * @param {string} token
 */
function normalizeNumberToken(token) {
  return token.replace(/\s+/g, "").toLowerCase().replace(",", ".");
}

/**
 * @param {{ id: string, value: string }[]} anchors
 * @param {string} translatedText
 */
export function missingAnchorsInTranslation(anchors, translatedText) {
  const hay = String(translatedText || "").toLowerCase();
  if (!anchors.length) return [];

  return anchors.filter((a) => {
    const raw = a.value.trim();
    if (!raw) return false;
    if (hay.includes(raw.toLowerCase())) return false;
    const norm = normalizeNumberToken(raw);
    if (/\d/.test(norm) && hay.includes(norm)) return false;
    if (/\d/.test(norm)) {
      const alt = norm.includes(".") ? norm.replace(".", ",") : norm.replace(",", ".");
      if (hay.includes(alt)) return false;
    }
    return true;
  });
}

/**
 * @param {{
 *   sourceText: string;
 *   translatedText: string;
 *   sourceLanguage: string;
 *   targetLanguage: string;
 *   anchors: { id: string, value: string }[];
 *   modelUncertain: boolean;
 * }} params
 */
export function assessTranslationQuality(params) {
  const unclearSource = sourceSoundsUnclear(params.sourceText);
  const missing = missingAnchorsInTranslation(params.anchors, params.translatedText);
  const negationRisk = negationPreservationRisk(
    params.sourceText,
    params.translatedText,
    params.sourceLanguage,
    params.targetLanguage,
  );

  const uncertain =
    params.modelUncertain ||
    unclearSource ||
    negationRisk ||
    missing.length > 0;

  return {
    uncertain,
    unclearSource,
    terminologyWarning: missing.length > 0 || negationRisk,
    missingAnchorCount: missing.length,
    negationRisk,
  };
}
