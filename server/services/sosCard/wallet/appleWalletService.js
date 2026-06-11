/**
 * Apple Wallet service — SKELETON ONLY.
 *
 * Phase 3 prepares the structure; it does NOT sign real .pkpass files. Signing requires the
 * Pass Type ID certificate, private key and Apple WWDR certificate — all provided via env at
 * runtime and kept strictly server-side (never in the frontend or bundle).
 *
 * When credentials are absent, `buildApplePass` throws a typed error so the route can answer
 * 501/"not configured" instead of attempting a broken signature.
 */
import { appleWalletConfig } from "./walletConfig.js";

export function isAppleWalletConfigured() {
  return appleWalletConfig().configured;
}

/**
 * Later: assemble pass.json from the minimal mapper payload, add icons, sign with the
 * Pass Type certificate + WWDR chain, and return a .pkpass Buffer
 * (Content-Type: application/vnd.apple.pkpass).
 *
 * @param {object} _walletPayload  Minimal payload from sosWalletMapper (no health data).
 * @returns {Promise<Buffer>}
 */
// eslint-disable-next-line no-unused-vars
export async function buildApplePass(_walletPayload) {
  if (!isAppleWalletConfigured()) {
    const err = new Error("apple_wallet_not_configured");
    err.code = "not_configured";
    throw err;
  }
  // Credentials present but signing intentionally not implemented in Phase 3.
  const err = new Error("apple_pass_signing_not_implemented");
  err.code = "not_implemented";
  throw err;
}
