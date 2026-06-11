/**
 * Google Wallet service — SKELETON ONLY.
 *
 * Phase 3 prepares the structure; it does NOT produce real signed "Add to Google Wallet" JWTs.
 * Production requires a Wallet Issuer ID, a service account (credentials JSON) and a Generic
 * pass class — all provided via env at runtime and kept strictly server-side.
 *
 * When credentials are absent, `buildGoogleSaveLink` throws a typed error so the route can
 * answer 501/"not configured" instead of emitting a broken/unsigned link.
 */
import { googleWalletConfig } from "./walletConfig.js";

export function isGoogleWalletConfigured() {
  return googleWalletConfig().configured;
}

/**
 * Later: build a Generic pass object from the minimal mapper payload, sign a JWT with the
 * service account key, and return https://pay.google.com/gp/v/save/<jwt>.
 *
 * @param {object} _walletPayload  Minimal payload from sosWalletMapper (no health data).
 * @returns {Promise<string>}  Add-to-Google-Wallet URL.
 */
// eslint-disable-next-line no-unused-vars
export async function buildGoogleSaveLink(_walletPayload) {
  if (!isGoogleWalletConfigured()) {
    const err = new Error("google_wallet_not_configured");
    err.code = "not_configured";
    throw err;
  }
  // Credentials present but JWT production intentionally not implemented in Phase 3.
  const err = new Error("google_wallet_jwt_not_implemented");
  err.code = "not_implemented";
  throw err;
}
