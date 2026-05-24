import { getWrongLanguagePhraseForPrompt } from "./liveTranslationWrongLanguagePhrase.js";

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
  const wrongLanguagePhrase = getWrongLanguagePhraseForPrompt(
    doctorLanguage === "en" || patientLanguage === "en" ? "en" : doctorLanguage,
  );

  return `
TWO-LANGUAGE CONTAINMENT (strict):
- ONLY these session languages are allowed: patient=${patientLanguage}, doctor/practice=${doctorLanguage}.
- Listen/transcribe ONLY in ${sourceLanguageName}; speak translation ONLY in ${targetLanguageName}.
- Do NOT answer in any third language.
- Do NOT explain in English by default.
- Do NOT use English as fallback unless English is one of the two selected session languages.
- If spoken language is outside the selected pair, do NOT translate confidently. Say ONLY: "${wrongLanguagePhrase}"
`.trim();
}
