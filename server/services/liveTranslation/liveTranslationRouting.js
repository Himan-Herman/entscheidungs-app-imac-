import { resolveLanguageName } from "./liveTranslationPrompt.js";

/**
 * Resolve language direction from UI-selected speaker (never inferred).
 * @param {{ patientLanguage: string; doctorLanguage: string; activeSpeaker: "patient" | "doctor" }} params
 */
export function buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker }) {
  const isPatient = activeSpeaker === "patient";
  const sourceLanguage = isPatient ? patientLanguage : doctorLanguage;
  const targetLanguage = isPatient ? doctorLanguage : patientLanguage;

  return {
    activeSpeaker,
    patientLanguage,
    doctorLanguage,
    sourceLanguage,
    targetLanguage,
    sourceLanguageName: resolveLanguageName(sourceLanguage),
    targetLanguageName: resolveLanguageName(targetLanguage),
    patientLanguageName: resolveLanguageName(patientLanguage),
    doctorLanguageName: resolveLanguageName(doctorLanguage),
  };
}
