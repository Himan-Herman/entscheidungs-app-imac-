/** Meda unclear-speech repeat phrase for Realtime prompts (server-side). */
const MEDA_UNCLEAR_PHRASES = {
  de: "Meda hat die Aussage akustisch nicht sicher verstanden. Bitte wiederholen Sie den Satz langsam.",
  en: "Meda could not clearly understand the statement acoustically. Please repeat the sentence slowly.",
  fr: "Meda n'a pas clairement compris la phrase. Veuillez répéter lentement.",
  es: "Meda no entendió claramente la frase. Por favor repítala lentamente.",
  it: "Meda non ha capito chiaramente la frase. Per favore ripetila lentamente.",
};

/** @param {string} targetLanguage */
export function getMedaUnclearPhraseForPrompt(targetLanguage) {
  const code = (targetLanguage || "en").toLowerCase();
  return MEDA_UNCLEAR_PHRASES[code] || MEDA_UNCLEAR_PHRASES.en;
}
