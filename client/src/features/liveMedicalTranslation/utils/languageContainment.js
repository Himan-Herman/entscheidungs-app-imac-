import { detectedLanguageMatches, normalizeLanguageCode } from "./languageBasedRouting.js";
import { isMedaWrongLanguagePhrase } from "./wrongLanguagePhrase.js";
import { isMedaUnclearPhrase } from "./repeatPhrase.js";

/**
 * @param {string | null | undefined} detected
 * @param {string} patientLanguage
 * @param {string} doctorLanguage
 */
/**
 * @param {string} targetLanguage
 * @param {string} patientLanguage
 * @param {string} doctorLanguage
 */
export function isTargetLanguageInPair(targetLanguage, patientLanguage, doctorLanguage) {
  const target = normalizeLanguageCode(targetLanguage);
  return (
    target === normalizeLanguageCode(patientLanguage) ||
    target === normalizeLanguageCode(doctorLanguage)
  );
}

export function isLanguageInSelectedPair(detected, patientLanguage, doctorLanguage) {
  if (!detected || !String(detected).trim()) return false;
  return (
    detectedLanguageMatches(detected, patientLanguage) ||
    detectedLanguageMatches(detected, doctorLanguage)
  );
}

/**
 * @param {string} patientLanguage
 * @param {string} doctorLanguage
 * @param {string} sourceLanguageName
 * @param {string} targetLanguageName
 */
export function buildTwoLanguageContainmentBlock(
  patientLanguage,
  doctorLanguage,
  sourceLanguageName,
  targetLanguageName,
) {
  return [
    "TWO-LANGUAGE CONTAINMENT (strict):",
    `- ONLY these session languages are allowed: patient=${patientLanguage}, doctor/practice=${doctorLanguage}.`,
    `- Listen/transcribe ONLY in ${sourceLanguageName}; speak translation ONLY in ${targetLanguageName}.`,
    "- Do NOT answer in any third language.",
    "- Do NOT explain in English by default.",
    "- Do NOT use English as fallback unless English is one of the two selected session languages.",
    "- If spoken language is outside the selected pair, do NOT translate confidently.",
  ].join("\n");
}

const ENGLISH_FALLBACK_MARKERS =
  /\b(the|please|repeat|i have|you have|since yesterday|how can i help|what brings you)\b/i;

/**
 * Heuristic: model output appears to be English when English is not selected.
 * @param {string} translated
 * @param {string} patientLanguage
 * @param {string} doctorLanguage
 */
export function isLikelyWrongLanguageOutput(translated, patientLanguage, doctorLanguage) {
  const patient = normalizeLanguageCode(patientLanguage);
  const doctor = normalizeLanguageCode(doctorLanguage);
  const text = String(translated || "").trim();
  if (!text || isMedaUnclearPhrase(text) || isMedaWrongLanguagePhrase(text)) {
    return false;
  }
  if (patient === "en" || doctor === "en") return false;
  return ENGLISH_FALLBACK_MARKERS.test(text);
}

/**
 * @param {{
 *   originalText?: string;
 *   translatedText: string;
 *   patientLanguage: string;
 *   doctorLanguage: string;
 *   targetLanguage: string;
 *   detectedLanguage?: string | null;
 *   repeatPhrase: string;
 * }} input
 */
export function sanitizeWrongLanguageTurn(input) {
  const text = String(input.translatedText || "").trim();
  if (isMedaWrongLanguagePhrase(text)) {
    return {
      isWrongLanguage: true,
      status: "wrongLanguage",
      originalText: "",
      translatedText: input.repeatPhrase,
      originalMissing: true,
      needsRepeatSpeech: text !== input.repeatPhrase,
    };
  }

  const outsidePair =
    (input.detectedLanguage &&
      !isLanguageInSelectedPair(
        input.detectedLanguage,
        input.patientLanguage,
        input.doctorLanguage,
      )) ||
    isLikelyWrongLanguageOutput(
      input.translatedText,
      input.patientLanguage,
      input.doctorLanguage,
    );

  if (!outsidePair) {
    return { isWrongLanguage: false };
  }

  return {
    isWrongLanguage: true,
    status: "wrongLanguage",
    originalText: "",
    translatedText: input.repeatPhrase,
    originalMissing: true,
    needsRepeatSpeech: input.translatedText.trim() !== input.repeatPhrase,
  };
}
