import { isCareRelationshipEnabled, isCommunicationV2Enabled } from "../config/featureFlags.js";

/** Requires CARE_RELATIONSHIP_ENABLED and COMMUNICATION_V2. */
export function requireCommunicationV2Feature(_req, res, next) {
  if (!isCareRelationshipEnabled() || !isCommunicationV2Enabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
