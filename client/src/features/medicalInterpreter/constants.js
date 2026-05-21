/** Local-only interpreter session store (Phase 1 — no server persistence). */

export const INTERPRETER_STORE_VERSION = 1;

/** Base key; suffixed with user id in store (see interpreterSessionStore.js). */
export const INTERPRETER_STORE_PREFIX = "medscoutx_interpreter_sessions_v1";

export const SESSION_STATUS_DRAFT = "draft";
export const SESSION_STATUS_ACTIVE = "active";
export const SESSION_STATUS_ENDED = "ended";

export const TURN_STATUS_DRAFT = "draft";
export const TURN_STATUS_CONFIRMED = "confirmed";
export const TURN_STATUS_TRANSLATED = "translated";
export const TURN_STATUS_BLOCKED = "blocked";
export const TURN_STATUS_ERROR = "error";

export const SPEAKER_PATIENT = "patient";
export const SPEAKER_DOCTOR = "doctor";

/** Privacy acknowledgement before live room (flag + timestamp only — no medical content). */
export const INTERPRETER_ACK_STORAGE_KEY = "medscoutx_interpreter_ack_v1";

/** Matches server INTERPRETER_MAX_TURN_CHARS — single-turn API limit. */
export const INTERPRETER_MAX_TURN_CHARS = 1200;
