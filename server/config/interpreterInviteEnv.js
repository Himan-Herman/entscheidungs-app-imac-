/**
 * Medical Interpreter practice invite settings (Phase 4.6).
 * Communication-only invites — no patient transcript storage.
 */

export const INTERPRETER_INVITE_METADATA_VERSION = "interpreter-invite-v1";

/** Default invite lifetime when not specified (hours). */
export const INTERPRETER_INVITE_DEFAULT_TTL_HOURS = 168;

export const INTERPRETER_INVITE_MAX_TTL_HOURS = 720;

export const INTERPRETER_INVITE_MIN_TTL_HOURS = 1;

/** Max active invites per practice. */
export const INTERPRETER_INVITE_MAX_PER_PRACTICE = 50;

export const INTERPRETER_INVITE_TYPES = new Set([
  "waiting_room",
  "reception",
  "doctor_room",
  "remote",
  "other",
]);

export const INTERPRETER_INVITE_STATUSES = new Set([
  "active",
  "revoked",
  "expired",
]);

/** Raw token entropy (bytes) before base64url encoding. */
export const INTERPRETER_INVITE_TOKEN_BYTES = 32;
