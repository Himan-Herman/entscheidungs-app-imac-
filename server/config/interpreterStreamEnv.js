/**
 * Medical Interpreter — streaming STT prototype limits (Phase 5.3).
 * Chunked upload only; no audio persistence.
 */

/** Max active stream per user. */
export const STREAM_MAX_ACTIVE_PER_USER = 1;

/** Max stream lifetime (ms). */
export const STREAM_MAX_DURATION_MS = 120_000;

/** Max single chunk size (bytes). */
export const STREAM_MAX_CHUNK_BYTES = 256 * 1024;

/** Max total audio per stream (bytes). */
export const STREAM_MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/** Min interval between partial Whisper previews (ms). */
export const STREAM_PARTIAL_MIN_INTERVAL_MS = 2500;

/** Max partial preview runs per stream. */
export const STREAM_MAX_PARTIAL_RUNS = 5;

/** Chunk timeslice hint for clients (ms). */
export const STREAM_RECOMMENDED_CHUNK_MS = 1000;
