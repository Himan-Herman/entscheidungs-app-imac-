import {
  LOCALE_OPTIONS,
  PRE_VISIT_SELECTABLE_LOCALE_CODES,
} from "../../../i18n/localeConfig.js";

const localeNameByCode = new Map(
  LOCALE_OPTIONS.map((row) => [row.code, row.nativeName]),
);

/**
 * Pre-Visit intake keeps its own, wider language list: it is the language the
 * intake is captured/translated in for the practice, not the language of the UI
 * chrome. It therefore does NOT shrink when the header picker does.
 */
export const PRE_VISIT_LANGUAGE_OPTIONS = PRE_VISIT_SELECTABLE_LOCALE_CODES.map(
  (code) => ({
    id: code,
    nativeName: localeNameByCode.get(code) || code.toUpperCase(),
  }),
);
