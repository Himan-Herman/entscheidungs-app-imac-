import { isCommunicationAiDraftsEnabled } from "../config/featureFlags.js";

/**
 * Requires COMMUNICATION_AI_DRAFTS on top of the messaging module flags.
 *
 * Returns 404 rather than 403 so a disabled capability is indistinguishable
 * from one that does not exist, matching requireCommunicationV2Feature.
 */
export function requireCommunicationAiDraftsFeature(_req, res, next) {
  if (!isCommunicationAiDraftsEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
