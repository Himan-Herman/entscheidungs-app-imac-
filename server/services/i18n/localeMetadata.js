/** Server copy of client locale registry — keep in sync with client/src/i18n/localeConfig.js */

export const RTL_LANGUAGE_CODES = ["ar", "fa", "ckb"];

export const LOCALE_OPTIONS = [
  { code: "de", nativeName: "Deutsch" },
  { code: "en", nativeName: "English" },
  { code: "fr", nativeName: "Français" },
  { code: "es", nativeName: "Español" },
  { code: "it", nativeName: "Italiano" },
  { code: "ru", nativeName: "Русский" },
  { code: "uk", nativeName: "Українська" },
  { code: "tr", nativeName: "Türkçe" },
  { code: "pt", nativeName: "Português" },
  { code: "ar", nativeName: "العربية" },
  { code: "fa", nativeName: "فارسی" },
  { code: "pl", nativeName: "Polski" },
  { code: "ro", nativeName: "Română" },
  { code: "nl", nativeName: "Nederlands" },
  { code: "ckb", nativeName: "کوردی (سۆرانی)" },
  { code: "ku", nativeName: "Kurdî (Kurmancî)" },
  { code: "el", nativeName: "Ελληνικά" },
  { code: "sq", nativeName: "Shqip" },
  { code: "hr", nativeName: "Hrvatski" },
  { code: "bs", nativeName: "Bosanski" },
  { code: "sr", nativeName: "Srpski" },
];

export const HEADER_SELECTABLE_LOCALE_CODES = ["de", "en"];

/** Patient workspace UI — keep in sync with client PATIENT_UI_SELECTABLE_LOCALE_CODES */
export const PATIENT_UI_SELECTABLE_LOCALE_CODES = ["de", "en", "fr", "es", "it"];

/** Practice workspace UI — keep in sync with client PRACTICE_UI_SELECTABLE_LOCALE_CODES */
export const PRACTICE_UI_SELECTABLE_LOCALE_CODES = ["de", "en", "fr", "es", "it"];

export const UI_FULLY_SUPPORTED_LOCALE_CODES = [
  ...new Set([
    ...HEADER_SELECTABLE_LOCALE_CODES,
    ...PATIENT_UI_SELECTABLE_LOCALE_CODES,
    ...PRACTICE_UI_SELECTABLE_LOCALE_CODES,
  ]),
];

const SUPPORTED = new Set(LOCALE_OPTIONS.map((o) => o.code));

export function isRtlLanguage(code) {
  return typeof code === "string" && RTL_LANGUAGE_CODES.includes(code.toLowerCase());
}

export function isSupportedLanguage(code) {
  return typeof code === "string" && SUPPORTED.has(code.toLowerCase());
}
