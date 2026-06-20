/**
 * Client gate for the patient "Rechnung verstehen" entry point.
 * Mirrors the patientInbox pattern: hidden unless VITE flag is explicitly on, and
 * cached off for the session if the server reports the feature disabled.
 * Server flag: ENABLE_PATIENT_BILLING_EXPLAIN. Client flag: VITE_PATIENT_BILLING_EXPLAIN_ENABLED.
 */
let disabledByServer = false;

export function isPatientBillingExplainClientEnabled() {
  if (disabledByServer) return false;
  const raw = import.meta.env.VITE_PATIENT_BILLING_EXPLAIN_ENABLED;
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return false;
}

/** @param {Response} res @param {Record<string, unknown>} data */
export function notePatientBillingExplainDisabledResponse(res, data) {
  if (res.status === 404 && data?.error === "feature_disabled") {
    disabledByServer = true;
  }
}
