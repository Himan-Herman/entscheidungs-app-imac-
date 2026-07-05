import {
  LOCALE_OPTIONS,
  PATIENT_UI_SELECTABLE_LOCALE_CODES,
} from "../../../i18n/localeConfig.js";

const localeNameByCode = new Map(
  LOCALE_OPTIONS.map((row) => [row.code, row.nativeName]),
);

/**
 * Patient-facing Pre-Visit intake follows the same selectable locale set as
 * the patient header language picker, so the language choices stay 1:1.
 */
export const PRE_VISIT_LANGUAGE_OPTIONS = PATIENT_UI_SELECTABLE_LOCALE_CODES.map(
  (code) => ({
    id: code,
    nativeName: localeNameByCode.get(code) || code.toUpperCase(),
  }),
);
