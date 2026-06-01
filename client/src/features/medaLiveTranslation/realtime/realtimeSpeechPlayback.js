/**
 * On-demand speech playback for Meda Realtime translated turns.
 * Uses the browser's built-in speechSynthesis API — no server request, no OpenAI call.
 * Only the existing translatedText is spoken; no new translation is triggered.
 */

/** ISO 639-1 → BCP-47 locale map for the languages supported by Meda Realtime. */
const LANG_BCP47 = {
  de: 'de-DE',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  ru: 'ru-RU',
  ar: 'ar-SA',
  tr: 'tr-TR',
  ro: 'ro-RO',
  hr: 'hr-HR',
  uk: 'uk-UA',
  vi: 'vi-VN',
  zh: 'zh-CN',
  fa: 'fa-IR',
  sr: 'sr-RS',
  cs: 'cs-CZ',
  sk: 'sk-SK',
};

/**
 * Speaks the given text in the given language using browser speechSynthesis.
 * Cancels any ongoing playback before starting.
 * No server request is made; no new translation is triggered.
 *
 * @param {string} text       The translated text to speak.
 * @param {string} langCode   ISO 639-1 language code (e.g. 'en', 'de').
 */
export function speakTranslation(text, langCode) {
  if (!text || !langCode || typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG_BCP47[langCode] ?? langCode;
  window.speechSynthesis.speak(utterance);
}

/** Stops any ongoing speechSynthesis playback. */
export function cancelSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
