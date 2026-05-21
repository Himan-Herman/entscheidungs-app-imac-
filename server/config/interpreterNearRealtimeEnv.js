/**
 * Medical Interpreter — near-realtime translation preview limits (Phase 5.4).
 * Smaller than full-turn translate to control token cost.
 */

/** Max characters per preview translate request (no conversation history). */
export const NEAR_REALTIME_MAX_CHUNK_CHARS = 600;

/** Minimum source text length before preview translate is allowed. */
export const NEAR_REALTIME_MIN_CHUNK_CHARS = 12;
