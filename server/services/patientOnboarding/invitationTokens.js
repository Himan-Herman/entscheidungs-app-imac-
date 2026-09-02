/**
 * Pure helpers for practice-issued patient invitations.
 *
 * Framework-free and DB-free, so the security-critical parts — entropy, hash-only
 * storage, and the two independent expiry rules — can be unit-tested with
 * `node --test` without a database.
 *
 * ONE invitation, TWO credentials, TWO lifetimes:
 *
 *   link / QR    tokenHash        valid for the invitation's own 7 days
 *   manual code  manualCodeHash   valid 60 minutes, optional, rotatable
 *
 * The manual code is a short on-site fallback for someone who cannot open a
 * link, never a second long-lived credential. Its expiry never shortens the
 * invitation, and rotating it never creates a new one.
 *
 * The typed-code alphabet and generator are deliberately imported from the
 * existing connect-code helpers rather than re-implemented: that code is already
 * proven bias-free and reviewed, and a second alphabet would be a second thing
 * to get wrong.
 */
import crypto from "crypto";
import {
  generateConnectCode,
  hashConnectCode,
  normalizeConnectCode,
} from "../../utils/connectCodeTokens.js";

/** The invitation itself. */
export const INVITATION_TTL_DAYS = 7;
/** The optional typed code living inside it. */
export const MANUAL_CODE_TTL_MINUTES = 60;

/** Stored lifecycle states. `expired` is DERIVED, never written — see isRedeemable. */
export const INVITATION_STATUSES = Object.freeze([
  "pending",
  "redeemed",
  "revoked",
  "superseded",
]);

/** Practice-local entry states. */
export const ENTRY_STATUSES = Object.freeze([
  "draft",
  "invited",
  "linked",
  "archived",
]);

/**
 * Link/QR token: 32 random bytes, base64url. 256 bits of entropy, well beyond
 * the 128-bit floor, because this one travels in a URL and lives for a week.
 * @returns {string}
 */
export function generateInvitationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * SHA-256 hex of a link token. The plaintext is returned to the practice exactly
 * once and never persisted.
 * @param {string} token
 * @returns {string}
 */
export function hashInvitationToken(token) {
  return crypto.createHash("sha256").update(String(token ?? "")).digest("hex");
}

/**
 * First characters of a link token, for the practice to recognise which
 * invitation a row refers to. 12 of 43 base64url characters leaves ~184 bits,
 * so this costs nothing that matters.
 * @param {string} token
 * @returns {string}
 */
export function invitationTokenPrefix(token) {
  return String(token ?? "").slice(0, 12);
}

/**
 * Typed on-site code, formatted ABCD-EFGH-JKLM over a 32-character alphabet
 * without 0/O/1/I. ~60 bits.
 *
 * There is deliberately no prefix column for this one: revealing 4 of 12
 * characters would give away roughly 20 bits of an already short credential,
 * and the practice reads the code out immediately rather than recognising it
 * later.
 * @returns {string}
 */
export function generateManualCode() {
  return generateConnectCode();
}

/**
 * SHA-256 hex of the NORMALISED code, so `ABCD-EFGH-JKLM` and `abcdefghjklm`
 * resolve to the same value and display formatting never affects the hash.
 * @param {string} code
 * @returns {string}
 */
export function hashManualCode(code) {
  return hashConnectCode(code);
}

/**
 * Uppercase, strip separators and whitespace.
 * @param {unknown} code
 * @returns {string}
 */
export function normalizeManualCode(code) {
  return normalizeConnectCode(code);
}

/**
 * @param {Date} [now]
 * @returns {Date}
 */
export function invitationExpiry(now = new Date()) {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * @param {Date} [now]
 * @returns {Date}
 */
export function manualCodeExpiry(now = new Date()) {
  return new Date(now.getTime() + MANUAL_CODE_TTL_MINUTES * 60 * 1000);
}

/** @param {Date|string|null|undefined} v @param {Date} now */
function isPast(v, now) {
  if (!v) return true;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) || d.getTime() <= now.getTime();
}

/**
 * Is this invitation usable through its LINK right now?
 *
 * `expired` is computed here rather than stored. A stored expiry status needs
 * either a scheduled job or a write on a read path, and the second is the shape
 * of bug this codebase has already had to close once. A derived answer cannot
 * drift.
 *
 * The granular reason exists for tests and logs; every caller facing the outside
 * world collapses all of them into one message, so nobody can tell a wrong token
 * from an expired, spent, revoked or replaced one.
 *
 * @param {{ status?: string, expiresAt?: Date|string } | null | undefined} row
 * @param {Date} [now]
 * @returns {{ ok: boolean, reason: "ok"|"not_found"|"redeemed"|"revoked"|"superseded"|"expired"|"not_pending" }}
 */
export function evaluateInvitationRedeemable(row, now = new Date()) {
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "redeemed") return { ok: false, reason: "redeemed" };
  if (row.status === "revoked") return { ok: false, reason: "revoked" };
  if (row.status === "superseded") return { ok: false, reason: "superseded" };
  if (row.status !== "pending") return { ok: false, reason: "not_pending" };
  if (isPast(row.expiresAt, now)) return { ok: false, reason: "expired" };
  return { ok: true, reason: "ok" };
}

/**
 * Is the MANUAL CODE usable right now?
 *
 * Both clocks must agree: the invitation has to be live AND the code's own
 * 60-minute window still open. A live code on a dead invitation is worthless,
 * and a dead code leaves the link untouched.
 *
 * @param {{ status?: string, expiresAt?: Date|string, manualCodeHash?: string|null, manualCodeExpiresAt?: Date|string|null } | null | undefined} row
 * @param {Date} [now]
 * @returns {{ ok: boolean, reason: string }}
 */
export function evaluateManualCodeUsable(row, now = new Date()) {
  const base = evaluateInvitationRedeemable(row, now);
  if (!base.ok) return base;
  if (!row.manualCodeHash) return { ok: false, reason: "no_manual_code" };
  if (isPast(row.manualCodeExpiresAt, now)) {
    return { ok: false, reason: "manual_code_expired" };
  }
  return { ok: true, reason: "ok" };
}

/**
 * May a fresh code be issued on this invitation?
 *
 * Rotation writes a new hash onto the SAME row. It never creates an invitation,
 * never supersedes anything and never touches `expiresAt`. The old hash is
 * overwritten, and that overwrite is what invalidates the previous code — no
 * extra bookkeeping.
 *
 * @param {{ status?: string, expiresAt?: Date|string } | null | undefined} row
 * @param {Date} [now]
 */
export function canRotateManualCode(row, now = new Date()) {
  return evaluateInvitationRedeemable(row, now);
}
