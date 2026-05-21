import { LOCALE_OPTIONS } from "../../../i18n/localeConfig.js";
import { isRtlLanguage } from "../../../i18n/localeConfig.js";

/**
 * Conversation languages aligned with server INTERPRETER_SUPPORTED_LANGUAGE_CODES.
 * UI labels use native names + Intl.DisplayNames (no extra locale bundles).
 */
export const INTERPRETER_SETUP_LANGUAGE_CODES = [
  "de",
  "en",
  "fr",
  "es",
  "it",
  "ru",
  "uk",
  "tr",
  "pt",
  "ar",
  "fa",
  "pl",
  "ro",
  "nl",
  "ckb",
  "ku",
  "el",
  "sq",
  "hr",
  "bs",
  "sr",
];

export const INTERPRETER_SETUP_LANGUAGE_OPTIONS = LOCALE_OPTIONS.filter((o) =>
  INTERPRETER_SETUP_LANGUAGE_CODES.includes(o.code),
).sort((a, b) => {
  const aRtl = isRtlLanguage(a.code) ? 0 : 1;
  const bRtl = isRtlLanguage(b.code) ? 0 : 1;
  if (aRtl !== bRtl) return aRtl - bRtl;
  return a.nativeName.localeCompare(b.nativeName, "en", { sensitivity: "base" });
});
