/**
 * Server error code -> i18n key for the translation UI.
 *
 * Every code the endpoint can return is mapped explicitly. An unmapped code
 * falls back to a generic message rather than showing the raw code, but the
 * test suite asserts the table is complete, so "generic" should only ever be
 * reached by a code that did not exist when this was written.
 *
 * ── Tone rules encoded here ─────────────────────────────────────────────────
 * • Never anthropomorphise. "The AI could not understand the document" is both
 *   wrong and misleading: extraction is deterministic and the refusals below
 *   happen before a model is ever involved.
 * • Never minimise an integrity failure. It is not "a small translation
 *   glitch" — the result was discarded precisely because it could not be
 *   trusted.
 * • Never expose internals. A patient does not learn which provider is
 *   configured, which guard fired, or what a masking pattern looks like.
 */

/** Error codes that must never render a result, however partial. */
export const RESULT_SUPPRESSING_ERRORS = Object.freeze([
  "integrity_failed",
  "document_medication_unverifiable",
  "document_dosage_unverifiable",
  "document_translation_invalid_response",
]);

/**
 * Codes describing a state of the deployment rather than of this document.
 * The UI shows these as "not available yet", never as a failure the patient
 * caused or could fix.
 */
export const UNAVAILABLE_ERRORS = Object.freeze([
  "feature_disabled",
  "document_translation_provider_not_configured",
]);

/** code -> key under patientPracticeDocuments.translation.errors */
const ERROR_KEYS = Object.freeze({
  feature_disabled: "notAvailable",
  document_translation_provider_not_configured: "notAvailable",

  document_not_found: "documentNotFound",
  document_unavailable: "documentUnavailable",
  link_not_active: "linkNotActive",
  file_not_found: "fileNotFound",

  document_type_not_translatable: "typeNotTranslatable",
  document_file_type_unsupported: "fileTypeUnsupported",
  document_text_unavailable: "textUnavailable",
  document_structure_unsupported: "structureUnsupported",
  document_encrypted: "encrypted",
  document_corrupt: "corrupt",
  document_too_large: "tooLarge",

  document_source_language_unsupported: "sourceLanguageUnsupported",
  document_source_language_uncertain: "sourceLanguageUncertain",

  document_medication_unverifiable: "medicationUnverifiable",
  document_dosage_unverifiable: "dosageUnverifiable",

  translation_target_language_unsupported: "targetLanguageUnsupported",
  translation_mode_invalid: "modeInvalid",
  validation_invalid_mode: "modeInvalid",
  validation_invalid_locale: "targetLanguageUnsupported",

  document_translation_provider_unavailable: "providerUnavailable",
  document_translation_rate_limited: "rateLimited",
  document_translation_timeout: "timeout",
  document_translation_invalid_response: "invalidResponse",
  integrity_failed: "integrityFailed",
});

/** Every code this UI knows about. */
export const KNOWN_ERROR_CODES = Object.freeze(Object.keys(ERROR_KEYS));

/**
 * @param {string} code
 * @returns {string} i18n key under patientPracticeDocuments.translation.errors
 */
export function translationErrorKey(code) {
  return ERROR_KEYS[code] ?? "generic";
}

/**
 * Whether a retry could plausibly succeed.
 *
 * A refusal about THIS document (its type, its structure, its medication) will
 * refuse again, so offering "try again" there is noise. A transport hiccup or a
 * rate limit is worth retrying.
 *
 * Note this is only about the button: the server performs at most one internal
 * repair attempt, and the UI never retries on its own.
 *
 * @param {string} code
 */
export function isRetryableError(code) {
  return [
    "document_translation_provider_unavailable",
    "document_translation_rate_limited",
    "document_translation_timeout",
  ].includes(code);
}

/** @param {string} code */
export function suppressesResult(code) {
  return RESULT_SUPPRESSING_ERRORS.includes(code);
}

/** @param {string} code */
export function isUnavailableState(code) {
  return UNAVAILABLE_ERRORS.includes(code);
}
