/**
 * Client locale registry.
 *
 * The canonical registry is shared/i18n/localeConfig.js. This file is NOT free
 * to drift from it: server/scripts/verifyLocaleSourceOfTruth.test.js compares
 * both and fails on any divergence in the locale data below.
 *
 * It is a separate file rather than a re-export because the frontend is
 * deployed with client/ as the Vercel root directory (client/vercel.json), so a
 * repository-root path is outside the client build context. Changing that
 * requires a deploy setting that lives outside the repository.
 *
 * When adding a language, change shared/i18n/localeConfig.js first, then mirror
 * it here. LANGUAGE_STORAGE_KEY and resolveInitialLanguage stay client-only —
 * they are browser concerns and are deliberately not part of the shared module.
 */

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

/**
 * The six UI languages the product ships as fully selectable. Every other entry
 * in LOCALE_OPTIONS stays visible in the picker but disabled, so users never land
 * in a half-translated interface.
 */
export const UI_SELECTABLE_LOCALE_CODES = ["de", "en", "fr", "es", "it", "ru"];

/** Header language picker: only these locales are selectable; others stay visible but disabled. */
export const HEADER_SELECTABLE_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/** Public landing page. */
export const LANDING_SELECTABLE_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/** Patient workspace. */
export const PATIENT_UI_SELECTABLE_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/** Practice workspace. */
export const PRACTICE_UI_SELECTABLE_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/**
 * Target languages offered when translating a single chat message.
 *
 * Mirrors MESSAGE_TRANSLATION_TARGET_LOCALE_CODES in shared/i18n/localeConfig.js
 * and, like it, is DERIVED — a language activated for the product appears here
 * on its own. The server refuses anything outside the same set, so the picker
 * cannot offer a language the request would then be rejected for.
 */
export const MESSAGE_TRANSLATION_TARGET_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

/**
 * Pre-Visit intake target languages — deliberately NOT the UI locale set.
 * This is the language a patient's pre-visit summary gets translated INTO for
 * the practice, so it must keep its wide reach (incl. RTL scripts) even though
 * the surrounding UI chrome ships in only six languages.
 */
export const PRE_VISIT_SELECTABLE_LOCALE_CODES = [
  "de", "en", "fr", "es", "it", "tr", "ru", "uk", "pt",
  "ar", "fa", "ckb", "ku", "el", "ro", "pl",
];

/**
 * Target languages for patient-facing document translation.
 *
 * DERIVED from UI_SELECTABLE_LOCALE_CODES, never hand-maintained: a language
 * activated centrally becomes available here automatically. Restating the codes
 * would recreate exactly the drift the shared registry exists to prevent.
 */
export const DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES = UI_SELECTABLE_LOCALE_CODES;

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
