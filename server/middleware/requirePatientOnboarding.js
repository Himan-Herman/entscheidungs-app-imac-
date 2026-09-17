import { isPatientOnboardingV2Enabled } from "../config/featureFlags.js";

/**
 * Blocks every onboarding route while PATIENT_ONBOARDING_V2 is off.
 *
 * 404 rather than 403, matching the existing feature gates: a disabled module
 * should look absent, not present-but-forbidden. "Forbidden" would confirm the
 * endpoint exists on this deployment, which is a free hint to anyone mapping the
 * surface, and the practice-side UI is hidden by the same flag anyway.
 */
export function requirePatientOnboardingFeature(_req, res, next) {
  if (!isPatientOnboardingV2Enabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}
