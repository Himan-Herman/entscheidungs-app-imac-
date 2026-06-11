/**
 * SOS Wallet — central credential / ENV validation.
 *
 * Wallet is OPTIONAL: missing credentials must never crash startup. This module only reports
 * whether each provider is configured. It NEVER logs or returns secret VALUES — only the
 * names of missing variables (server-side) and a generic availability boolean (client-facing).
 *
 * No certificates, keys or secrets are stored in this repo. All values come from the
 * environment at runtime and stay server-side.
 */

/** True if an env var is set to a non-empty string. */
function present(name) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** Required env vars for Apple Wallet (.pkpass signing) — all server-side only. */
export const APPLE_WALLET_ENV = [
  "APPLE_WALLET_PASS_TYPE_ID", // e.g. pass.com.medscoutx.sos
  "APPLE_WALLET_TEAM_ID",
  "APPLE_WALLET_CERT_PEM", // Pass Type ID certificate (PEM)
  "APPLE_WALLET_CERT_KEY_PEM", // private key (PEM) — server only
  "APPLE_WALLET_WWDR_PEM", // Apple WWDR intermediate certificate (PEM)
];

/** Required env vars for Google Wallet (Generic pass + signed Add-to-Wallet JWT). */
export const GOOGLE_WALLET_ENV = [
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON", // service account credentials JSON — server only
  "GOOGLE_WALLET_CLASS_ID", // generic pass class id
];

export function appleWalletConfig() {
  const missing = APPLE_WALLET_ENV.filter((n) => !present(n));
  return { configured: missing.length === 0, missing };
}

/**
 * Parse GOOGLE_WALLET_SERVICE_ACCOUNT_JSON into an object, or null when absent/invalid.
 * NEVER logs or returns the raw content — parse errors are swallowed to avoid leaking secrets.
 * A valid service account must contain a client_email and a private_key.
 */
export function parseGoogleServiceAccount() {
  const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.client_email === "string" && typeof obj.private_key === "string") {
      return obj;
    }
    return null;
  } catch {
    return null; // never log the content
  }
}

export function googleWalletConfig() {
  const missing = GOOGLE_WALLET_ENV.filter((n) => !present(n));
  // The service account JSON must additionally parse and contain client_email + private_key.
  const serviceAccountValid = parseGoogleServiceAccount() !== null;
  if (present("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") && !serviceAccountValid) {
    missing.push("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON:invalid");
  }
  return { configured: missing.length === 0 && serviceAccountValid, missing };
}

/**
 * Base URL of the public emergency page (frontend). Reuses the existing FRONTEND_URL so the
 * wallet QR points at the SAME page the in-app QR already uses. No trailing slash.
 */
export function getEmergencyBaseUrl() {
  const raw = process.env.FRONTEND_URL || process.env.API_BASE_URL || "";
  return raw.replace(/\/+$/, "");
}

/** Build the public emergency URL for a token. The QR/barcode carries ONLY this URL. */
export function buildEmergencyUrl(token) {
  const base = getEmergencyBaseUrl();
  return base ? `${base}/emergency/${token}` : `/emergency/${token}`;
}
