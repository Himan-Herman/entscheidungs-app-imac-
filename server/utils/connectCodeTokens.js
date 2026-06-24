/**
 * Pure helpers for the patient-generated practice connection code.
 * Framework-free + DB-free so the security-critical logic (high-entropy generation,
 * hash-only storage, timing-safe verification, TTL + redeemability rules) can be
 * unit-tested with `node --test`. The plaintext code is shown to the patient once;
 * only its SHA-256 hash is ever persisted.
 */
import crypto from "crypto";

/** Time-to-live for a connect code, in minutes (short-lived by design). */
export const CONNECT_CODE_TTL_MINUTES = 15;

/** Lifecycle states of a connect code. */
export const CONNECT_CODE_STATUSES = Object.freeze(["active", "used", "expired", "revoked"]);

/**
 * Unambiguous alphabet (no 0/O/1/I) for human-typed codes. 32 chars → a random byte
 * (0–255) maps via `% 32` with NO modulo bias (256 is an exact multiple of 32).
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_GROUPS = 3;
const CODE_GROUP_LEN = 4; // 12 chars → 32^12 ≈ 1.15e18 combinations

/**
 * Generate a fresh, high-entropy code formatted as `ABCD-EFGH-JKLM` for readability.
 * @returns {string}
 */
export function generateConnectCode() {
  const total = CODE_GROUPS * CODE_GROUP_LEN;
  const bytes = crypto.randomBytes(total);
  let raw = "";
  for (let i = 0; i < total; i++) {
    raw += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  const groups = [];
  for (let i = 0; i < CODE_GROUPS; i++) {
    groups.push(raw.slice(i * CODE_GROUP_LEN, (i + 1) * CODE_GROUP_LEN));
  }
  return groups.join("-");
}

/**
 * Normalize a code for hashing / comparison: uppercase, strip separators + whitespace
 * so `ABCD-EFGH-JKLM` and `abcdefghjklm` resolve to the same value.
 * @param {unknown} input
 * @returns {string}
 */
export function normalizeConnectCode(input) {
  return String(input || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * SHA-256 hex of the NORMALIZED code (so display formatting never affects the hash).
 * @param {string} code
 * @returns {string}
 */
export function hashConnectCode(code) {
  return crypto.createHash("sha256").update(normalizeConnectCode(code)).digest("hex");
}

/**
 * First chars of the normalized code — for the patient's own list display only.
 * @param {string} code
 * @returns {string}
 */
export function connectCodePrefix(code) {
  return normalizeConnectCode(code).slice(0, CODE_GROUP_LEN);
}

/**
 * Timing-safe check that a supplied code matches a stored hash.
 * @param {string} code
 * @param {string} hash
 * @returns {boolean}
 */
export function verifyConnectCode(code, hash) {
  if (!code || !hash) return false;
  const a = hashConnectCode(code);
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(String(hash), "hex"));
  } catch {
    return false;
  }
}

/**
 * Expiry timestamp for a freshly generated code.
 * @param {Date} [now]
 * @param {number} [ttlMinutes]
 * @returns {Date}
 */
export function connectCodeExpiry(now = new Date(), ttlMinutes = CONNECT_CODE_TTL_MINUTES) {
  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

/**
 * Pure redeemability verdict for a stored code row. Returns a granular `reason`
 * for testing/logging; the route layer collapses every non-ok reason to a single
 * generic error so a practice cannot distinguish wrong / expired / used / revoked
 * (no enumeration).
 * @param {{ status?: string, expiresAt?: Date|string } | null | undefined} row
 * @param {Date} [now]
 * @returns {{ ok: boolean, reason: "ok"|"not_found"|"used"|"revoked"|"expired"|"not_active" }}
 */
export function evaluateConnectCodeRedeemable(row, now = new Date()) {
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "used") return { ok: false, reason: "used" };
  if (row.status === "revoked") return { ok: false, reason: "revoked" };
  const expiresAt = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);
  const expired =
    !(expiresAt instanceof Date) ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime();
  if (row.status === "expired" || expired) return { ok: false, reason: "expired" };
  if (row.status !== "active") return { ok: false, reason: "not_active" };
  return { ok: true, reason: "ok" };
}
