/** Meda unclear-speech repeat phrase for Realtime prompts (server-side). */
const MEDA_UNCLEAR_PHRASES = {
  de: "Meda hat die vorherige Aussage nicht sicher verstanden. Bitte wiederholen Sie den Satz.",
  en: "Meda did not clearly understand the previous statement. Please repeat the sentence.",
};

/** @param {string} targetLanguage */
export function getMedaUnclearPhraseForPrompt(targetLanguage) {
  const code = (targetLanguage || "en").toLowerCase();
  return MEDA_UNCLEAR_PHRASES[code] || MEDA_UNCLEAR_PHRASES.en;
}
