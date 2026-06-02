/**
 * Anamnesis communication languages — patient ↔ practice.
 *
 * This list is intentionally wider than the global website UI languages (de/en/fr/it/es).
 * The global UI language controls the app shell; these codes control which language
 * a patient may fill in the questionnaire and which language the practice receives.
 *
 * Codes marked hasUiTranslation=true have a static anamnesisPublic.js translation file.
 * For all other codes the UI falls back to English; question labels are translated
 * dynamically via the controlled AI translation service.
 *
 * RTL: Arabic (ar), Farsi (fa), Sorani Kurdish (ckb), Hebrew (he), Urdu (ur).
 *
 * ja / ko / zh are not in the global LOCALE_OPTIONS but are valid BCP-47 codes
 * supported by the AI translation layer and added to the server's ANAMNESIS_VALID_LANGUAGES.
 */

export const ANAMNESIS_UI_LANGUAGE_CODES = ["de", "en", "fr", "it", "es"];

export const ANAMNESIS_RTL_CODES = ["ar", "fa", "ckb", "he", "ur"];

/** All languages the patient may select in the QR intake form. */
export const ANAMNESIS_COMMUNICATION_LANGUAGES = [
  // ── Languages with full static UI translation ─────────────────────────────
  { code: "de", nativeName: "Deutsch" },
  { code: "en", nativeName: "English" },
  { code: "fr", nativeName: "Français" },
  { code: "it", nativeName: "Italiano" },
  { code: "es", nativeName: "Español" },
  // ── Additional languages — UI falls back to English ───────────────────────
  { code: "tr", nativeName: "Türkçe" },
  { code: "ar", nativeName: "العربية" },
  { code: "fa", nativeName: "فارسی" },
  { code: "ru", nativeName: "Русский" },
  { code: "uk", nativeName: "Українська" },
  { code: "pl", nativeName: "Polski" },
  { code: "ckb", nativeName: "کوردی (سۆرانی)" },
  { code: "ku", nativeName: "Kurdî (Kurmancî)" },
  { code: "bs", nativeName: "Bosanski" },
  { code: "hr", nativeName: "Hrvatski" },
  { code: "sr", nativeName: "Srpski" },
  { code: "ro", nativeName: "Română" },
  { code: "nl", nativeName: "Nederlands" },
  { code: "el", nativeName: "Ελληνικά" },
  { code: "sq", nativeName: "Shqip" },
  { code: "pt", nativeName: "Português" },
  { code: "he", nativeName: "עברית" },
  { code: "ur", nativeName: "اردو" },
  { code: "ja", nativeName: "日本語" },
  { code: "ko", nativeName: "한국어" },
  { code: "zh", nativeName: "中文" },
];

export const ANAMNESIS_COMMUNICATION_LANGUAGE_CODES = new Set(
  ANAMNESIS_COMMUNICATION_LANGUAGES.map((l) => l.code),
);

/** Returns true if the given code is right-to-left in the anamnesis context. */
export function isAnamnesisRtlLang(code) {
  return typeof code === "string" && ANAMNESIS_RTL_CODES.includes(code);
}

/**
 * Returns the UI fallback language for a given patient communication language.
 * If the language has a static anamnesisPublic.js file, returns the code itself.
 * Otherwise returns "en" so the UI strings gracefully show in English.
 */
export function getAnamnesisUiLang(patientLang) {
  return ANAMNESIS_UI_LANGUAGE_CODES.includes(patientLang) ? patientLang : "en";
}

/**
 * Detects the best initial patient language from the browser's navigator.language.
 * Falls back to "de" if no match.
 */
export function detectAnamnesisLang() {
  const nav = (navigator.language || navigator.languages?.[0] || "de")
    .split("-")[0]
    .toLowerCase();
  return ANAMNESIS_COMMUNICATION_LANGUAGE_CODES.has(nav) ? nav : "de";
}
