import {
  HEADER_SELECTABLE_LOCALE_CODES,
  LOCALE_OPTIONS,
  isRtlLanguage,
  isSupportedLanguage,
} from "./localeMetadata.js";

/**
 * Locale metadata for API consumers — full UI strings stay on the client bundles.
 */
export function listLocalesMetadata() {
  const active = new Set(HEADER_SELECTABLE_LOCALE_CODES);
  return LOCALE_OPTIONS.map((o) => ({
    code: o.code,
    nativeName: o.nativeName,
    rtl: isRtlLanguage(o.code),
    fullySupported: active.has(o.code),
    fallbackChain: active.has(o.code) ? [o.code] : [o.code, "en", "de"],
  }));
}

/**
 * @param {string} code
 */
export function validateUiLocale(code) {
  const c = String(code || "").trim().toLowerCase();
  if (!isSupportedLanguage(c)) return null;
  return c;
}
