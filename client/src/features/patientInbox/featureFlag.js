/** Server returns 404 + feature_disabled when PATIENT_INBOX is off — cached for the session. */
let inboxDisabledByServer = false;

export function isPatientInboxClientEnabled() {
  if (inboxDisabledByServer) return false;
  const raw = import.meta.env.VITE_PATIENT_INBOX_ENABLED;
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return false;
}

/** @param {Response} res @param {Record<string, unknown>} data */
export function notePatientInboxDisabledResponse(res, data) {
  if (res.status === 404 && data?.error === "feature_disabled") {
    inboxDisabledByServer = true;
  }
}
