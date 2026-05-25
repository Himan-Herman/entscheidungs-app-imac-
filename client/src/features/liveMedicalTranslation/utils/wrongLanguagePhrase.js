/** Wrong-language warning spoken in the listener's target language. */
const WRONG_LANGUAGE_PHRASES = {
  de: "Nur die ausgewählten Gesprächssprachen werden unterstützt. Bitte wiederholen Sie den Satz in einer der gewählten Sprachen.",
  en: "Only the selected conversation languages are supported. Please repeat the sentence in one of the chosen languages.",
  fr: "La langue détectée ne correspond pas aux langues de conversation sélectionnées. Veuillez choisir la bonne langue ou répéter la phrase.",
  es: "El idioma detectado no coincide con los idiomas de conversación seleccionados. Por favor, elija el idioma correcto o repita la frase.",
  it: "La lingua rilevata non corrisponde alle lingue di conversazione selezionate. Si prega di scegliere la lingua corretta o ripetere la frase.",
  fa: "زبان شناسایی‌شده با زبان‌های انتخاب‌شده گفتگو مطابقت ندارد. لطفاً زبان درست را انتخاب کنید یا جمله را تکرار کنید.",
  ar: "The detected language does not match the selected conversation languages. Please choose the correct language or repeat the sentence.",
  ru: "Обнаруженный язык не соответствует выбранным языкам разговора. Пожалуйста, выберите правильный язык или повторите фразу.",
  tr: "Algılanan dil seçilen görüşme dilleriyle eşleşmiyor. Lütfen doğru dili seçin veya cümleyi tekrarlayın.",
};

const WRONG_LANGUAGE_MARKERS = [
  "nur die ausgewählten gesprächssprachen",
  "only the selected conversation languages",
  "passt nicht zu den ausgewählten gesprächssprachen",
  "does not match the selected conversation languages",
  "ne correspond pas aux langues",
  "no coincide con los idiomas",
  "non corrisponde alle lingue",
];

/** @param {string} targetLanguageCode */
export function getWrongLanguagePhrase(targetLanguageCode) {
  const code = (targetLanguageCode || "de").toLowerCase();
  return WRONG_LANGUAGE_PHRASES[code] || WRONG_LANGUAGE_PHRASES.de;
}

/** @param {string} text */
export function isMedaWrongLanguagePhrase(text) {
  if (!text || typeof text !== "string") return false;
  const normalized = text.trim().toLowerCase();
  return WRONG_LANGUAGE_MARKERS.some((marker) => normalized.includes(marker));
}

/** @param {string} targetLanguageCode */
export function getWrongLanguagePhraseForPrompt(targetLanguageCode) {
  return getWrongLanguagePhrase(targetLanguageCode);
}
