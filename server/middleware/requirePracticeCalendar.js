import { isPracticeCalendarEnabled } from "../config/featureFlags.js";

export function requirePracticeCalendarFeature(req, res, next) {
  if (!isPracticeCalendarEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
