import { isUnclearTranslationPhrase } from "./medicalGlossary.js";

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

  if (isUnclearTranslationPhrase(translated, input.targetLanguage)) {
    return "unclear";
  }

  if (input.overlapDetected) {
    return "unclear";
  }

  const original = String(input.originalText || "").trim();
  if (!original) {
    return "unclear";
  }

  return "translated";
}

/** @param {string} text */
export function isLikelyEmptyOrNoiseTranscript(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return true;
  if (trimmed.length <= 1) return true;
  if (/^[.?!,\-\s…]+$/u.test(trimmed)) return true;
  return false;
}
