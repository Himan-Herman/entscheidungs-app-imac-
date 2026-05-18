import {
  isCareRelationshipEnabled,
  isMedicationPlanV2Enabled,
} from "../config/featureFlags.js";

export function requireMedicationPlanV2Feature(_req, res, next) {
  if (!isCareRelationshipEnabled() || !isMedicationPlanV2Enabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
