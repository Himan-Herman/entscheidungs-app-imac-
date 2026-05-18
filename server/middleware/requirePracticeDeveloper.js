import { isPracticeDeveloperUiEnabled } from "../config/featureFlags.js";

export function requirePracticeDeveloperFeature(req, res, next) {
  if (!isPracticeDeveloperUiEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
