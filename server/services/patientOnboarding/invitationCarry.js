/**
 * Carrying a practice invitation across account creation.
 *
 * THE GAP THIS CLOSES
 * -------------------
 * A patient without an account opens the invitation, registers, and confirms
 * their e-mail. The confirmation link opens in a NEW tab — the mail client
 * decides that, not us — and the invitation lived only in the old tab's
 * sessionStorage. The new tab signed in and landed on a page that knew nothing
 * about any invitation. To connect, the patient had to dig out the practice's
 * e-mail again and start over. Most would not.
 *
 * HOW IT TRAVELS
 * --------------
 * In the URL FRAGMENT of the confirmation link (`#invitation=<token>`), exactly
 * like the invitation link itself. A fragment is never sent to a server, and a
 * browser keeps it across the verify endpoint's redirect when the redirect
 * target has none of its own, so it reaches /login without passing through an
 * access log, a Referer header or analytics. It goes only into the confirmation
 * mail, i.e. to the address the person just registered with — somebody who
 * already holds the token, because they sent it to us.
 *
 * WHAT IS CHECKED
 * ---------------
 * Shape first, then that it is an invitation that could be redeemed right now.
 * Anything else is dropped SILENTLY. This is a convenience: the claim decides
 * everything again, with its own locks, and registration answers identically
 * whether or not a carry happened — so the carry cannot be used as an oracle
 * for "is this string a live credential".
 *
 * NOTHING IS STORED. The token is not written to the user row, a log or any
 * table. It exists in memory for the length of one request, and in the one
 * e-mail the patient asked for.
 */
import { isPatientOnboardingV2Enabled } from "../../config/featureFlags.js";
import { previewInvitationByToken } from "./practicePatientInvitationService.js";

/** 32 random bytes as base64url is 43 characters; allow a little headroom. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,128}$/;

/**
 * Where the auth flow may send somebody afterwards.
 *
 * An ALLOWLIST, not a sanitiser. `next` crosses an e-mail and a server
 * redirect, and "any internal path" is still enough to aim a freshly verified
 * user at a page of an attacker's choosing inside our own origin. The auth flow
 * only ever needs to come back to one place.
 */
export const AUTH_RETURN_PATHS = new Set(["/patient-invitation"]);

/** @returns {string|null} the allowed path, or null */
export function safeAuthReturnPath(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return AUTH_RETURN_PATHS.has(value) ? value : null;
}

/**
 * The invitation token to carry, or null.
 *
 * Never throws: a failure here must not turn a registration into an error.
 *
 * @param {unknown} raw
 * @returns {Promise<string|null>}
 */
export async function resolveCarriedInvitation(raw) {
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  if (!TOKEN_SHAPE.test(token)) return null;
  if (!isPatientOnboardingV2Enabled()) return null;
  try {
    await previewInvitationByToken(token);
    return token;
  } catch {
    return null;
  }
}

/**
 * The e-mail confirmation link, optionally carrying the invitation back.
 *
 * `mailToken` is the PLAINTEXT that goes into the mail — deliberately not
 * called `verifyToken`, which is the column that only ever holds its hash
 * (verifyPhase6bSecurity.test.js scans auth.js for exactly that name).
 *
 * @param {{ apiBase: string, mailToken: string, invitationToken?: string|null }} args
 */
export function buildVerifyLink({ apiBase, mailToken, invitationToken = null }) {
  const base = `${String(apiBase).replace(/\/+$/, "")}/api/auth/verify-email?token=${encodeURIComponent(
    mailToken,
  )}`;
  if (!invitationToken) return base;
  return `${base}&next=${encodeURIComponent("/patient-invitation")}#invitation=${encodeURIComponent(
    invitationToken,
  )}`;
}

/**
 * Where the verify endpoint sends the browser.
 *
 * No fragment of its own: that is what lets the browser keep the one the
 * confirmation link carried.
 *
 * @param {{ loginUrl: string, status: string, next?: string|null }} args
 */
export function buildVerifyRedirect({ loginUrl, status, next = null }) {
  const params = new URLSearchParams({ verify: status });
  const allowed = safeAuthReturnPath(next);
  if (allowed) params.set("next", allowed);
  return `${loginUrl}?${params.toString()}`;
}
