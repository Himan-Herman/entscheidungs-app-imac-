import { isLiveMedicalTranslationEnabled } from "../config/featureFlags.js";

export function requireLiveMedicalTranslationFeature(req, res, next) {
  if (!isLiveMedicalTranslationEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
