/**
 * Medical Interpreter — request timing (Phase 2.7).
 */

/** JSON translate/simplify request budget. */
export const INTERPRETER_JSON_REQUEST_TIMEOUT_MS = 45_000;

/** Calm retry delay after transient network failure. */
export const INTERPRETER_REQUEST_RETRY_DELAY_MS = 900;

/** How long to show “back online” notice. */
export const INTERPRETER_RECONNECTED_BANNER_MS = 4_000;
