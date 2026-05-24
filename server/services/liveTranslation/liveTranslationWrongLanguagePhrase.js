/** Wrong-language warning for Realtime prompts (server-side). */
const WRONG_LANGUAGE_PHRASES = {
  de: "Die erkannte Sprache passt nicht zu den ausgewählten Gesprächssprachen. Bitte wählen Sie die richtige Sprache oder wiederholen Sie den Satz.",
  en: "The detected language does not match the selected conversation languages. Please choose the correct language or repeat the sentence.",
  fa: "زبان شناسایی‌شده با زبان‌های انتخاب‌شده گفتگو مطابقت ندارد. لطفاً زبان درست را انتخاب کنید یا جمله را تکرار کنید.",
};

/** @param {string} targetLanguage */
export function getWrongLanguagePhraseForPrompt(targetLanguage) {
  const code = (targetLanguage || "de").toLowerCase();
  return WRONG_LANGUAGE_PHRASES[code] || WRONG_LANGUAGE_PHRASES.de;
}
