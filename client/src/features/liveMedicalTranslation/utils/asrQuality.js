import { isMedaUnclearPhrase } from "./repeatPhrase.js";
import { isSemanticTranslationDrift } from "./translationSemanticCheck.js";

const HALLUCINATION_CONTENT_PATTERNS = [
  /\b(cough|phlegm|headache|fever|pain|nausea|allerg|symptom|medication|diagnos)/i,
  /\b(husten|schleim|kopfschmerz|fieber|schmerz|übelkeit|allerg|symptom|medikament|diagnos)/i,
  /\bsince yesterday\b/i,
  /\bseit gestern\b/i,
  /\bfor \d+ days?\b/i,
  /\bseit \d+ tag/i,
  /\bfor three days\b/i,
  /\bfor 3 days\b/i,
];

/**
 * Decide whether a turn should be marked unclear instead of confidently translated.
 * Prefer repeat over inventing content when ASR or overlap is unreliable.
 * @param {{
 *   originalText?: string;
 *   translatedText: string;
 *   targetLanguage: string;
 *   overlapDetected?: boolean;
 *   forcedStatus?: string;
 * }} input
 */
export function resolveTurnStatus(input) {
  if (input.forcedStatus) return input.forcedStatus;

  const translated = String(input.translatedText || "").trim();
  if (!translated) return "unclear";

  if (isMedaUnclearPhrase(translated)) {
    return "unclear";
  }

  if (input.overlapDetected) {
    return "unclear";
  }

  const original = String(input.originalText || "").trim();
  if (!original || isLikelyEmptyOrNoiseTranscript(original)) {
    return "unclear";
  }

  if (isLikelyHallucinatedTranslation(original, translated)) {
    return "unclear";
  }

  if (isSemanticTranslationDrift(original, translated)) {
    return "unclear";
  }

  return "translated";
}

/**
 * Detect when the model likely invented medical content not present in the source.
 * Only applies cross-language keyword checks when the original is unreliable.
 * @param {string} originalText
 * @param {string} translatedText
 */
export function isLikelyHallucinatedTranslation(originalText, translatedText) {
  const original = String(originalText || "").trim().toLowerCase();
  const translated = String(translatedText || "").trim().toLowerCase();
  if (!translated || isMedaUnclearPhrase(translated)) return false;

  const originalUnreliable = !original || isLikelyEmptyOrNoiseTranscript(original);
  const originalWords = original.split(/\s+/).filter(Boolean);
  const translatedWords = translated.split(/\s+/).filter(Boolean);

  if (originalUnreliable) {
    for (const pattern of HALLUCINATION_CONTENT_PATTERNS) {
      if (pattern.test(translated)) return true;
    }
    return translatedWords.length >= 8;
  }

  if (isSemanticTranslationDrift(original, translated)) {
    return true;
  }

  return false;
}

/** @param {string} text */
export function isLikelyEmptyOrNoiseTranscript(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return true;
  if (trimmed.length <= 1) return true;
  if (/^[.?!,\-\s…]+$/u.test(trimmed)) return true;
  if (/^(hm+|mhm+|uh+|äh+|um+|hmm+)$/iu.test(trimmed)) return true;
  return false;
}

/**
 * Normalize unclear turns: replace invented translation with Meda repeat phrase and hide unreliable originals.
 * @param {{
 *   originalText?: string;
 *   translatedText: string;
 *   targetLanguage: string;
 *   overlapDetected?: boolean;
 *   forcedStatus?: string;
 *   repeatPhrase: string;
 * }} input
 */
export function sanitizeUnclearTurn(input) {
  const status = resolveTurnStatus(input);
  const original = String(input.originalText || "").trim();
  const rawTranslated = String(input.translatedText || "").trim();
  const hallucinated = isLikelyHallucinatedTranslation(original, rawTranslated);
  const finalStatus = status === "unclear" || hallucinated ? "unclear" : "translated";

  if (finalStatus === "translated") {
    return {
      status: "translated",
      originalText: original,
      translatedText: rawTranslated,
      originalMissing: false,
      needsRepeatSpeech: false,
    };
  }

  const hideOriginal =
    !original ||
    isLikelyEmptyOrNoiseTranscript(original) ||
    hallucinated ||
    isLikelyHallucinatedTranslation(original, rawTranslated);

  return {
    status: "unclear",
    originalText: hideOriginal ? "" : original,
    translatedText: input.repeatPhrase,
    originalMissing: hideOriginal || !original,
    needsRepeatSpeech: rawTranslated !== input.repeatPhrase,
  };
}
