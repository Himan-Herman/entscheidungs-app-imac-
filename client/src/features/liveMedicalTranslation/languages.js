import { LOCALE_OPTIONS } from "../../i18n/localeConfig.js";

/** Languages selectable for live doctor–patient translation. */
export const LIVE_TRANSLATION_LANGUAGE_CODES = [
  "de", "en", "fr", "es", "it", "ru", "uk", "tr", "pt", "ar", "fa", "pl", "ro", "nl",
  "ckb", "ku", "el", "sq", "hr", "bs", "sr", "he", "ur",
];

const nativeNameByCode = Object.fromEntries(
  LOCALE_OPTIONS.map((o) => [o.code, o.nativeName]),
);

export function liveTranslationLanguageLabel(code) {
  return nativeNameByCode[code] || code;
}

export const LIVE_TRANSLATION_LANGUAGE_OPTIONS = LIVE_TRANSLATION_LANGUAGE_CODES.map(
  (code) => ({
    code,
    label: liveTranslationLanguageLabel(code),
  }),
);
