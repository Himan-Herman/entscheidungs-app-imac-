import { isPracticeBookingEnabled } from "../config/featureFlags.js";

export function requirePracticeBookingFeature(req, res, next) {
  if (!isPracticeBookingEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
