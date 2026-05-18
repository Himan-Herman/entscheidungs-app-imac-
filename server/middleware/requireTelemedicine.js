import { isTelemedicineUiEnabled } from "../config/featureFlags.js";

export function requireTelemedicineFeature(req, res, next) {
  if (!isTelemedicineUiEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
