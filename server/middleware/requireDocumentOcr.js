import { isDocumentOcrUiEnabled } from "../config/featureFlags.js";

export function requireDocumentOcrFeature(req, res, next) {
  if (!isDocumentOcrUiEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
