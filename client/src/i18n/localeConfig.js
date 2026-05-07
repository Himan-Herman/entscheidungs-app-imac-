/** Persisted preference — keep stable for existing users. */
export const LANGUAGE_STORAGE_KEY = "medscout_language";

/** Scalable locale registry — add entries here when introducing a new language. */
export const LOCALE_OPTIONS = [
  { code: "de", nativeName: "Deutsch" },
  { code: "en", nativeName: "English" },
  { code: "fr", nativeName: "Français" },
  { code: "es", nativeName: "Español" },
  { code: "it", nativeName: "Italiano" },
];

export const SUPPORTED_LANGUAGE_CODES = LOCALE_OPTIONS.map((o) => o.code);

export function isSupportedLanguage(code) {
  return typeof code === "string" && SUPPORTED_LANGUAGE_CODES.includes(code);
}

/**
 * Restore saved locale, else browser language if supported, else legacy rule:
 * English → en, otherwise default de (matches previous DE/EN behaviour).
 */
export function resolveInitialLanguage(stored, navigatorLang) {
  if (isSupportedLanguage(stored)) return stored;
  const prefix = String(navigatorLang || "")
    .split("-")[0]
    .toLowerCase();
  if (isSupportedLanguage(prefix)) return prefix;
  const nav = String(navigatorLang || "").toLowerCase();
  if (nav.startsWith("en")) return "en";
  return "de";
}
