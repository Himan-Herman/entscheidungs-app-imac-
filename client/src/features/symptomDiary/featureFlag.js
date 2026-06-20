/**
 * Client gate for the patient symptom diary tab in the health record.
 * Mirrors the patientInbox/billing pattern: hidden unless the VITE flag is explicitly on,
 * and cached off for the session if the server reports the feature disabled.
 * Server flag: ENABLE_SYMPTOM_DIARY. Client flag: VITE_SYMPTOM_DIARY_ENABLED.
 */
let disabledByServer = false;

export function isSymptomDiaryClientEnabled() {
  if (disabledByServer) return false;
  const raw = import.meta.env.VITE_SYMPTOM_DIARY_ENABLED;
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return false;
}

/** @param {Response} res @param {Record<string, unknown>} data */
export function noteSymptomDiaryDisabledResponse(res, data) {
  if (res.status === 404 && data?.error === "feature_disabled") {
    disabledByServer = true;
  }
}
