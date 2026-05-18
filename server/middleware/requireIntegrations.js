import { isIntegrationsUiEnabled } from "../config/featureFlags.js";

/** Returns 404 when integration UI/API layer is fully disabled (master + sandbox off). */
export function requireIntegrationsUi(req, res, next) {
  if (!isIntegrationsUiEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
