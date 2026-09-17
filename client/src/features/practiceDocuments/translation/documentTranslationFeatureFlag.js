/**
 * Client gate for the document transformation section.
 *
 * Mirrors the patientInbox / patientBillingExplain pattern: hidden unless the
 * VITE flag is explicitly on, and latched off for the session once the server
 * says the feature is unavailable.
 *
 * Server flag: ENABLE_DOCUMENT_TRANSLATION (default false).
 * Client flag: VITE_DOCUMENT_TRANSLATION_ENABLED (default false).
 *
 * Both default to off, and neither is enabled in any production configuration.
 * The code ships; the feature does not.
 */

let disabledByServer = false;

export function isDocumentTranslationClientEnabled() {
  if (disabledByServer) return false;
  const raw = import.meta.env.VITE_DOCUMENT_TRANSLATION_ENABLED;
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return false;
}

/**
 * Latch the section off once the server reports the feature or its provider as
 * unavailable, so a patient is not offered a control that cannot work.
 *
 * @param {Response} res
 * @param {Record<string, unknown>} data
 */
export function noteDocumentTranslationDisabledResponse(res, data) {
  const code = data?.error;
  if (res?.status === 404 && code === "feature_disabled") disabledByServer = true;
  if (res?.status === 503 && code === "document_translation_provider_not_configured") {
    disabledByServer = true;
  }
}

/** Test seam — the latch is module state and would otherwise leak between cases. */
export function resetDocumentTranslationDisabledLatch() {
  disabledByServer = false;
}
