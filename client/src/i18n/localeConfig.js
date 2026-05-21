/** Persisted preference — keep stable for existing users. */
export const LANGUAGE_STORAGE_KEY = "medscout_language";

/**
 * Right-to-left UI scripts — `dir` on `<html>` set in LanguageProvider.
 * Kurdish Kurmancî (ku) uses Latin script and stays LTR.
 */
export const RTL_LANGUAGE_CODES = ["ar", "fa", "ckb", "he", "ur"];

export function isRtlLanguage(code) {
  return (
    typeof code === "string" &&
    RTL_LANGUAGE_CODES.includes(code.toLowerCase())
  );
}

/** Scalable locale registry — add entries here when introducing a new language. */
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
  { code: "he", nativeName: "עברית" },
  { code: "ur", nativeName: "اردو" },
];

export const SUPPORTED_LANGUAGE_CODES = LOCALE_OPTIONS.map((o) => o.code);

/** Header language picker: only these locales are selectable; others stay visible but disabled. */
export const HEADER_SELECTABLE_LOCALE_CODES = ["de", "en"];

/** Patient workspace: full UI in DE, EN, FR, ES, or IT. */
export const PATIENT_UI_SELECTABLE_LOCALE_CODES = ["de", "en", "fr", "es", "it"];

/** Practice workspace: full UI in DE, EN, FR, ES, or IT. */
export const PRACTICE_UI_SELECTABLE_LOCALE_CODES = ["de", "en", "fr", "es", "it"];

export function isSupportedLanguage(code) {
  return typeof code === "string" && SUPPORTED_LANGUAGE_CODES.includes(code);
}

/**
 * Restore saved locale, else browser language if supported, else English
 * (neutral default for international visitors; message fallback is en → de).
 */
export function resolveInitialLanguage(stored, navigatorLang) {
  if (isSupportedLanguage(stored)) return stored;
  const prefix = String(navigatorLang || "")
    .split("-")[0]
    .toLowerCase();
  if (isSupportedLanguage(prefix)) return prefix;
  return "en";
}
