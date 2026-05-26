/** Meda repeat-request phrase spoken in the listener's target language. */
const MEDA_UNCLEAR_PHRASES = {
  de: "Meda hat die vorherige Aussage akustisch nicht verstanden. Bitte wiederholen Sie den Satz.",
  en: "Meda did not understand the previous statement acoustically. Please repeat the sentence.",
  fr: "Meda n'a pas compris clairement la phrase précédente. Veuillez répéter la phrase.",
  es: "Meda no entendió acústicamente la frase anterior. Por favor repita la frase.",
  it: "Meda non ha capito acusticamente la frase precedente. Per favore ripeti la frase.",
  ru: "Meda не поняла предыдущее высказывание на слух. Пожалуйста, повторите предложение.",
  uk: "Meda не зрозуміла попереднє висловлювання на слух. Будь ласка, повторіть речення.",
  tr: "Meda önceki ifadeyi akustik olarak anlamadı. Lütfen cümleyi tekrar edin.",
  pl: "Meda nie zrozumiała akustycznie poprzedniego zdania. Proszę powtórzyć zdanie.",
  pt: "Meda não entendeu acusticamente a frase anterior. Por favor, repita a frase.",
  ar: "Meda did not understand the previous statement acoustically. Please repeat the sentence.",
  fa: "Meda did not understand the previous statement acoustically. Please repeat the sentence.",
};

const LEGACY_UNCLEAR_MARKERS = [
  "die vorherige aussage war unklar",
  "the previous statement was unclear",
  "meda hat die vorherige aussage nicht sicher verstanden",
  "meda hat die vorherige aussage akustisch nicht verstanden",
  "meda did not clearly understand the previous statement",
  "meda did not understand the previous statement acoustically",
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
