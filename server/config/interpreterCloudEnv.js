/**
 * Medical Interpreter cloud storage limits (Phase 3.2+).
 * Communication-only scope: no audio persistence; consent required for writes.
 */

export const INTERPRETER_CLOUD_CONSENT_VERSION = "interpreter-cloud-v1";

/** Max HTTP body size for cloud session POST/PUT (bytes). */
export const INTERPRETER_CLOUD_MAX_REQUEST_BODY_BYTES = 600_000;

/** Max top-level keys on session save body (abuse guard). */
export const INTERPRETER_CLOUD_MAX_BODY_KEYS = 48;

export const INTERPRETER_CLOUD_SCHEMA_VERSION = 1;

/** Max sessions per user in cloud. */
export const INTERPRETER_CLOUD_MAX_SESSIONS_PER_USER = 100;

/** Max turns per session. */
export const INTERPRETER_CLOUD_MAX_TURNS_PER_SESSION = 200;

/** Max total characters across all turn text fields per session. */
export const INTERPRETER_CLOUD_MAX_CHARS_PER_SESSION = 250_000;

export const INTERPRETER_CLOUD_SESSION_STATUSES = new Set([
  "draft",
  "active",
  "ended",
]);

export const INTERPRETER_CLOUD_TURN_STATUSES = new Set([
  "draft",
  "confirmed",
  "translated",
  "blocked",
  "error",
]);

export const INTERPRETER_CLOUD_SPEAKERS = new Set(["patient", "doctor"]);

/** Keys that must never appear in stored JSON (audio, etc.). */
export const INTERPRETER_CLOUD_FORBIDDEN_KEYS = new Set([
  "audio",
  "audioBlob",
  "audioUrl",
  "recording",
  "microphone",
  "rawAudio",
  "mediaRecorder",
  "chunks",
  "profileSnapshot",
  "diagnosis",
  "triage",
  "treatment",
  "medication",
  "urgency",
  "specialist",
]);
