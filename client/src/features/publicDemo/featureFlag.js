/**
 * Client gate for the public DemoDay / Messe showcase ("/demo").
 *
 * Mirrors the existing feature-flag pattern (see patientBillingExplain/featureFlag.js):
 * the showcase is hidden unless the build-time flag is explicitly on.
 *
 * Flag: VITE_ENABLE_PUBLIC_DEMO_MODE  (Vite build-time, baked at deploy).
 *   - off (default / unset / "false" / "0"): no demo button, "/demo" redirects home,
 *     login + landing behave exactly as before.
 *   - on ("true" / "1"): landing + login show a "Messe-Demo ansehen" button and
 *     "/demo" renders a self-contained showcase with dummy data only.
 *
 * IMPORTANT: this flag only toggles a public, read-only demo built from static
 * sample data. It never grants access to protected routes, never issues a token,
 * and the demo page never calls the backend. Real auth (ProtectedRoute + server
 * requireAuth/JWT) is completely untouched.
 */
export function isPublicDemoModeEnabled() {
  const raw = import.meta.env.VITE_ENABLE_PUBLIC_DEMO_MODE;
  if (raw === "true" || raw === "1") return true;
  return false;
}
