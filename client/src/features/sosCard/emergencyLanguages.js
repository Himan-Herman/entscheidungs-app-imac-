/**
 * Single source of truth for the SOS "preferred emergency language" set.
 *
 * Used by the patient form dropdown, the read-only preview and the public emergency page.
 * Labels are autonyms (each language in its own name) so the list reads the same regardless of
 * the surrounding UI language. `rtl` drives dir="rtl" on the public emergency page.
 *
 * Codes mirror the backend EMERGENCY_LANGS validation set. Keep both in sync.
 */
export const EMERGENCY_LANGUAGES = [
  { code: "de", label: "Deutsch", rtl: false },
  { code: "en", label: "English", rtl: false },
  { code: "fr", label: "Français", rtl: false },
  { code: "it", label: "Italiano", rtl: false },
  { code: "es", label: "Español", rtl: false },
  { code: "ckb", label: "سۆرانی", rtl: true },
  { code: "kmr", label: "Kurmancî", rtl: false },
  { code: "fa", label: "فارسی", rtl: true },
  { code: "ar", label: "العربية", rtl: true },
  { code: "tr", label: "Türkçe", rtl: false },
  { code: "pl", label: "Polski", rtl: false },
  { code: "ru", label: "Русский", rtl: false },
  { code: "uk", label: "Українська", rtl: false },
  { code: "el", label: "Ελληνικά", rtl: false },
  { code: "ur", label: "اردو", rtl: true },
];

export const EMERGENCY_LANGUAGE_CODES = EMERGENCY_LANGUAGES.map((l) => l.code);

const RTL_CODES = new Set(EMERGENCY_LANGUAGES.filter((l) => l.rtl).map((l) => l.code));

/** True for ar, fa, ckb, ur. */
export function isRtlEmergencyLang(code) {
  return RTL_CODES.has(code);
}

/** Autonym label for a code, or the raw code if unknown. */
export function emergencyLanguageLabel(code) {
  const hit = EMERGENCY_LANGUAGES.find((l) => l.code === code);
  return hit ? hit.label : code || "";
}
