/** Repeat-request phrase by target language code. */
const REPEAT_PHRASES = {
  de: "Die vorherige Aussage war unklar. Bitte wiederholen.",
  en: "The previous statement was unclear. Please repeat.",
  fr: "La déclaration précédente n'était pas claire. Veuillez répéter.",
  es: "La declaración anterior no fue clara. Por favor, repita.",
  it: "La dichiarazione precedente non era chiara. Per favore, ripeta.",
};

/** @param {string} targetLanguageCode */
export function getRepeatPhrase(targetLanguageCode) {
  const code = (targetLanguageCode || "en").toLowerCase();
  return REPEAT_PHRASES[code] || REPEAT_PHRASES.en;
}
