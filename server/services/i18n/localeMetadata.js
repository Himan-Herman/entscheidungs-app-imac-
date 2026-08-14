/**
 * Server-side locale registry — re-export facade.
 *
 * This file used to be a hand-maintained "server copy" of the client registry.
 * It had drifted: it was missing `he` and `ur`, listed only three RTL scripts,
 * exposed just ["de","en"] as header-selectable, and omitted `ru` from the
 * patient/practice UI sets — so a server-side locale check would have rejected
 * Russian even though the product ships it.
 *
 * The registry now lives in shared/i18n/localeConfig.js and is imported rather
 * than copied. The exports below are kept byte-for-byte identical in NAME so
 * every existing import site keeps working unchanged; only their values are now
 * correct.
 *
 * Do not add locale data to this file. Add it to the shared module.
 */

export {
  DOCUMENT_TRANSLATION_TARGET_LOCALE_CODES,
  HEADER_SELECTABLE_LOCALE_CODES,
  LANDING_SELECTABLE_LOCALE_CODES,
  LOCALE_OPTIONS,
  PATIENT_UI_SELECTABLE_LOCALE_CODES,
  PRACTICE_UI_SELECTABLE_LOCALE_CODES,
  PRE_VISIT_SELECTABLE_LOCALE_CODES,
  RTL_LANGUAGE_CODES,
  SUPPORTED_LANGUAGE_CODES,
  UI_FULLY_SUPPORTED_LOCALE_CODES,
  UI_SELECTABLE_LOCALE_CODES,
  isRtlLanguage,
  isSupportedLanguage,
  normalizeDocumentTranslationTarget,
} from "../../../shared/i18n/localeConfig.js";
