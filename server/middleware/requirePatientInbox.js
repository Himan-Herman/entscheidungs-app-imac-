import { isPatientInboxEnabled } from "../config/featureFlags.js";

/** Blocks patient inbox routes when PATIENT_INBOX is not set. */
export function requirePatientInboxFeature(_req, res, next) {
  if (!isPatientInboxEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
