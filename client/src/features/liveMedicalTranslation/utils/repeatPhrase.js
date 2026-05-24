/** Meda repeat-request phrase spoken in the listener's target language. */
const MEDA_UNCLEAR_PHRASES = {
  de: "Meda hat die vorherige Aussage nicht sicher verstanden. Bitte wiederholen Sie den Satz.",
  en: "Meda did not clearly understand the previous statement. Please repeat the sentence.",
  fr: "Meda n'a pas clairement compris la phrase précédente. Veuillez répéter la phrase.",
  es: "Meda no entendió claramente la frase anterior. Por favor, repita la frase.",
  it: "Meda non ha capito chiaramente l'affermazione precedente. Per favore, ripeta la frase.",
  ru: "Meda не смогла чётко понять предыдущее высказывание. Пожалуйста, повторите фразу.",
  uk: "Meda не змогла чітко зрозуміти попереднє висловлювання. Будь ласка, повторіть речення.",
  tr: "Meda önceki ifadeyi net anlayamadı. Lütfen cümleyi tekrarlayın.",
  pl: "Meda nie zrozumiała wyraźnie poprzedniego zdania. Proszę powtórzyć zdanie.",
  pt: "Meda não entendeu claramente a frase anterior. Por favor, repita a frase.",
  ar: "Meda did not clearly understand the previous statement. Please repeat the sentence.",
  fa: "Meda did not clearly understand the previous statement. Please repeat the sentence.",
};

const LEGACY_UNCLEAR_MARKERS = [
  "die vorherige aussage war unklar",
  "the previous statement was unclear",
  "meda hat die vorherige aussage nicht sicher verstanden",
  "meda did not clearly understand the previous statement",
];

/** @param {string} targetLanguageCode */
export function getMedaUnclearRepeatPhrase(targetLanguageCode) {
  const code = (targetLanguageCode || "en").toLowerCase();
  return MEDA_UNCLEAR_PHRASES[code] || MEDA_UNCLEAR_PHRASES.en;
}

/** @deprecated Use getMedaUnclearRepeatPhrase */
export function getRepeatPhrase(targetLanguageCode) {
  return getMedaUnclearRepeatPhrase(targetLanguageCode);
}

/** @param {string} text */
export function isMedaUnclearPhrase(text) {
  if (!text || typeof text !== "string") return false;
  const normalized = text.trim().toLowerCase();
  if (LEGACY_UNCLEAR_MARKERS.some((marker) => normalized.includes(marker))) {
    return true;
  }
  return Object.values(MEDA_UNCLEAR_PHRASES).some((phrase) =>
    normalized.includes(phrase.toLowerCase().slice(0, 40)),
  );
}

/** @param {string} targetLanguageCode */
export function getUnclearPhraseForPrompt(targetLanguageCode) {
  return getMedaUnclearRepeatPhrase(targetLanguageCode);
}
