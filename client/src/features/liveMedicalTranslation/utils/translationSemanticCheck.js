/**
 * Detect when a translation introduces medical meaning not present in the ASR original.
 * Cross-language keyword/concept matching only — no transcript logging.
 */

/** @typedef {"duration" | "symptoms" | "greeting_help" | "fever_question" | "allergy" | "negation"} ConceptId */

/** @type {{ id: ConceptId; patterns: RegExp[] }[]} */
const CONCEPT_RULES = [
  {
    id: "duration",
    patterns: [
      /\bhow long\b/i,
      /\bsince yesterday\b/i,
      /\bsince\b/i,
      /\bfor \d+\s*(day|week|month)/i,
      /\byesterday\b/i,
      /\bwie lange\b/i,
      /\bseit (gestern|\d+)/i,
      /\bseit\b/i,
      /\bgestern\b/i,
      /\blange haben\b/i,
      /\b\d+\s*tag(en)?\b/i,
      /\bbeschwerden schon\b/i,
      /\bdiese beschwerden\b/i,
    ],
  },
  {
    id: "symptoms",
    patterns: [
      /\bheadache\b/i,
      /\bfever\b/i,
      /\bpain\b/i,
      /\bcough\b/i,
      /\bnausea\b/i,
      /\bsymptom/i,
      /\bbeschwerden\b/i,
      /\bkopfschmerz/i,
      /\bfieber\b/i,
      /\bschmerz/i,
      /\bhusten\b/i,
      /\bübelkeit\b/i,
    ],
  },
  {
    id: "allergy",
    patterns: [/\ballerg/i, /\ballergie/i],
  },
  {
    id: "fever_question",
    patterns: [/\bdo you have a fever\b/i, /\bhaben sie fieber\b/i, /\bhave a fever\b/i],
  },
  {
    id: "greeting_help",
    patterns: [
      /\bhow can i help\b/i,
      /\bcan i help you\b/i,
      /\bhow may i help\b/i,
      /\bhelp you\b/i,
      /\bwie kann ich\b/i,
      /\bich ihnen helfen\b/i,
      /\bwhat can i do for you\b/i,
    ],
  },
  {
    id: "negation",
    patterns: [/\bkeine\b/i, /\bno allergies\b/i, /\bnot have\b/i, /\bdo not have\b/i],
  },
];

/** Concepts that must not appear in translation unless present in original. */
const STRICT_INTRODUCED = new Set(["duration", "symptoms", "allergy", "fever_question"]);

/**
 * @param {string} text
 * @returns {Set<ConceptId>}
 */
export function detectTranslationConcepts(text) {
  const normalized = String(text || "").trim();
  const found = new Set();
  if (!normalized) return found;

  for (const rule of CONCEPT_RULES) {
    if (rule.patterns.some((p) => p.test(normalized))) {
      found.add(rule.id);
    }
  }
  return found;
}

/**
 * True when translation adds clinical/duration meaning not supported by the original transcript.
 * @param {string} originalText
 * @param {string} translatedText
 */
export function isSemanticTranslationDrift(originalText, translatedText) {
  const original = String(originalText || "").trim();
  const translated = String(translatedText || "").trim();
  if (!original || !translated) return false;

  const origConcepts = detectTranslationConcepts(original);
  const transConcepts = detectTranslationConcepts(translated);

  if (origConcepts.has("greeting_help") && !origConcepts.has("duration") && !origConcepts.has("symptoms")) {
    if (transConcepts.has("duration") || transConcepts.has("symptoms")) {
      return true;
    }
  }

  for (const concept of transConcepts) {
    if (!STRICT_INTRODUCED.has(concept)) continue;
    if (!origConcepts.has(concept)) {
      return true;
    }
  }

  const origWords = original.split(/\s+/).filter(Boolean).length;
  const transWords = translated.split(/\s+/).filter(Boolean).length;
  if (origWords > 0 && origWords <= 7 && transWords >= origWords + 5) {
    for (const concept of transConcepts) {
      if (STRICT_INTRODUCED.has(concept) && !origConcepts.has(concept)) {
        return true;
      }
    }
  }

  return false;
}
