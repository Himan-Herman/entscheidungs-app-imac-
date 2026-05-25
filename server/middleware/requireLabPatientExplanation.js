import {
  isCareRelationshipEnabled,
  isLabPatientExplanationEnabled,
  isPracticeDocumentsV2Enabled,
} from "../config/featureFlags.js";

export function requireLabPatientExplanationFeature(req, res, next) {
  if (
    !isCareRelationshipEnabled() ||
    !isPracticeDocumentsV2Enabled() ||
    !isLabPatientExplanationEnabled()
  ) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
