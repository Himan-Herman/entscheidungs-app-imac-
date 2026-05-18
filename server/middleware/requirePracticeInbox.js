import { isCareRelationshipEnabled, isPracticeInboxEnabled } from "../config/featureFlags.js";

/** Requires CARE_RELATIONSHIP_ENABLED and PRACTICE_INBOX. */
export function requirePracticeInboxFeature(_req, res, next) {
  if (!isCareRelationshipEnabled() || !isPracticeInboxEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
