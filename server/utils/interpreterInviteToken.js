import crypto from "crypto";

/**
 * Generate a URL-safe invite token (shown once to practice staff).
 */
export function generateInterpreterInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * SHA-256 hex digest — only this is stored at rest (see telemedicineTokens pattern).
 * @param {string} token
 */
export function hashInterpreterInviteToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/**
 * @param {string} token
 */
export function isValidInterpreterInviteTokenFormat(token) {
  const t = String(token || "").trim();
  if (t.length < 16 || t.length > 128) return false;
  return /^[A-Za-z0-9_-]+$/.test(t);
}

/**
 * Short prefix for staff list display (not secret; full token never stored).
 * @param {string} token
 */
export function interpreterInviteTokenPrefix(token) {
  return String(token || "").slice(0, 8);
}
