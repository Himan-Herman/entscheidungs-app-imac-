import { isPracticeAnamnesisEnabled } from "../config/featureFlags.js";

export function requirePracticeAnamnesisFeature(req, res, next) {
  if (!isPracticeAnamnesisEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
