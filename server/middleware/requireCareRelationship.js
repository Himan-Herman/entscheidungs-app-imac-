import { isCareRelationshipEnabled } from "../config/featureFlags.js";

/** Blocks Phase-1 care-relationship routes when CARE_RELATIONSHIP_ENABLED is not set. */
export function requireCareRelationshipFeature(_req, res, next) {
  if (!isCareRelationshipEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
