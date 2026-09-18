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
 *
 * Activating a language in UI_SELECTABLE_LOCALE_CODES also makes it the
 * automatic first-visit language for its countries — see
 * ./location/countryLanguages.js. Its code must match the one used there.
 */

import { detectLocationLanguage } from "./location/detectLocationLanguage.js";

/** Persisted preference — keep stable for existing users. */
export const LANGUAGE_STORAGE_KEY = "medscout_language";

/**
 * Written next to LANGUAGE_STORAGE_KEY, with the value "manual", only when the
 * user chose the language themselves. Without it the language follows the
 * visitor's location and nothing is stored.
 */
export const LANGUAGE_SOURCE_STORAGE_KEY = "medscout_language_source";
export const LANGUAGE_SOURCE_MANUAL = "manual";

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
 * What the app stored ON ITS OWN before location detection existed: the
 * browser language if it was any registry code, else English. A stored value
 * that differs from this can only have come from the header picker.
 */
function legacyAutoLanguage(navigatorLanguage) {
  const prefix = String(navigatorLanguage || "")
    .split("-")[0]
    .toLowerCase();
  return isSupportedLanguage(prefix) ? prefix : "en";
}

/**
 * Startup language.
 *
 * A language the user picked in the header (source "manual") always wins and
 * follows them to any location. Otherwise the language comes from where they
 * are (detectLocationLanguage) and is re-detected on every visit, so it is
 * never persisted.
 *
 * Values saved before `medscout_language_source` existed carry no marker. The
 * old code wrote the browser language automatically, so such a value only
 * counts as a real choice when it differs from what the old code would have
 * written — that keeps earlier header choices without freezing old guesses.
 *
 * @returns {{ language: string, source: "manual"|"location"|"browser"|"default" }}
 */
export function resolveInitialLanguage({
  stored,
  storedSource,
  timeZone,
  navigatorLanguage,
  navigatorLanguages,
}) {
  if (HEADER_SELECTABLE_LOCALE_CODES.includes(stored)) {
    if (storedSource === LANGUAGE_SOURCE_MANUAL) {
      return { language: stored, source: LANGUAGE_SOURCE_MANUAL };
    }
    if (storedSource == null && stored !== legacyAutoLanguage(navigatorLanguage)) {
      return { language: stored, source: LANGUAGE_SOURCE_MANUAL };
    }
  }
  const browserLanguages = [
    ...(Array.isArray(navigatorLanguages) ? navigatorLanguages : []),
    navigatorLanguage,
  ].filter(Boolean);
  return detectLocationLanguage({
    timeZone,
    browserLanguages,
    selectableCodes: HEADER_SELECTABLE_LOCALE_CODES,
  });
}
