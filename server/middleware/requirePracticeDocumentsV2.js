import {
  isCareRelationshipEnabled,
  isPracticeDocumentsV2Enabled,
} from "../config/featureFlags.js";

export function requirePracticeDocumentsV2Feature(_req, res, next) {
  if (!isCareRelationshipEnabled() || !isPracticeDocumentsV2Enabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
