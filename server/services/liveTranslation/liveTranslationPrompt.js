import { buildLanguageRouting } from "./liveTranslationRouting.js";

/** ISO 639-1 → English language name for Realtime instructions. */
const LANGUAGE_NAMES = {
  de: "German",
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ru: "Russian",
  uk: "Ukrainian",
  tr: "Turkish",
  pt: "Portuguese",
  ar: "Arabic",
  fa: "Persian",
  pl: "Polish",
  ro: "Romanian",
  nl: "Dutch",
  ckb: "Central Kurdish (Sorani)",
  ku: "Kurdish (Kurmanji)",
  el: "Greek",
  sq: "Albanian",
  hr: "Croatian",
  bs: "Bosnian",
  sr: "Serbian",
  he: "Hebrew",
  ur: "Urdu",
};

export function resolveLanguageName(code) {
  if (!code || typeof code !== "string") return "Unknown";
  return LANGUAGE_NAMES[code.toLowerCase()] || code;
}

const MEDA_CORE_INSTRUCTIONS =
  "You are Meda, a medical interpreter. Translate only the last final user utterance into the target language. Output only the translation. No explanation. No diagnosis. No advice.";

/**
 * Build strict Realtime system instructions for manual speaker ping-pong translation.
 * @param {{ patientLanguage: string; doctorLanguage: string; activeSpeaker: "patient" | "doctor" }} params
 */
export function buildLiveTranslationInstructions({
  patientLanguage,
  doctorLanguage,
  activeSpeaker,
}) {
  const routing = buildLanguageRouting({ patientLanguage, doctorLanguage, activeSpeaker });

  return `${MEDA_CORE_INSTRUCTIONS} Target language: ${routing.targetLanguageName} (${routing.targetLanguage}). Source language: ${routing.sourceLanguageName} (${routing.sourceLanguage}). activeSpeaker=${routing.activeSpeaker}.`;
}

export { buildLanguageRouting };
