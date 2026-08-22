/**
 * Reads a Bearer token when one is present, and does not mind when it is not.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Some flows are deliberately open to guests. The Pre-Visit preparation is one:
 * a practice hands out a QR code and the patient prepares without an account.
 * Putting `requireAuth` in front of such a route would delete the flow rather
 * than secure it — but the route still needs to KNOW when the caller does have
 * an account, so it can authorize them that way instead of demanding a token
 * they were never given.
 *
 * ── What it does not do ─────────────────────────────────────────────────────
 * It authorizes nothing. It populates `req.user` when a valid token is present
 * and leaves it undefined otherwise, and the route decides what that means. A
 * route using this and then treating "no user" as "allowed" would be open by
 * accident, so every caller of this must have its own answer for the anonymous
 * case.
 *
 * An invalid or expired token is treated as no token rather than as an error:
 * a guest with a stale session in local storage should still be able to use a
 * flow that never needed a session at all.
 */

import jwt from "jsonwebtoken";

export function optionalAuth(req, _res, next) {
  const header = req.headers?.authorization;
  const token =
    header && header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!token) return next();

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // Deliberately silent, and deliberately not an error. The caller is simply
    // not authenticated, which is a state this route already handles.
  }
  return next();
}
