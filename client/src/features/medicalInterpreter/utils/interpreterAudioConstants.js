/**
 * Medical Interpreter — client audio constants (Phase 2.3).
 * Aligned with server INTERPRETER_MIN_AUDIO_BYTES where applicable.
 */

/** Maximum single PTT clip length. */
export const INTERPRETER_RECORDING_MAX_MS = 60_000;

/** Ignore accidental taps shorter than this. */
export const INTERPRETER_RECORDING_MIN_MS = 400;

/** Reject empty or near-empty blobs (matches server minimum). */
export const INTERPRETER_MIN_BLOB_BYTES = 400;

/**
 * MediaRecorder timeslice — improves ondataavailable on iOS Safari and
 * reduces risk of empty blobs when stop() is called before a chunk flush.
 */
export const INTERPRETER_RECORDING_TIMESLICE_MS = 200;

/** Upload + Whisper processing budget (client-side abort). */
export const INTERPRETER_TRANSCRIBE_TIMEOUT_MS = 45_000;

/** One calm retry after transient network failure. */
export const INTERPRETER_TRANSCRIBE_RETRY_DELAY_MS = 900;

/** After this much silence following speech, recording stops automatically. */
export const INTERPRETER_SILENCE_AUTO_STOP_MS = 900;

/** Minimum voiced audio before silence auto-stop applies. */
export const INTERPRETER_SILENCE_MIN_SPEECH_MS = 220;
