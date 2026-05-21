/**
 * Medical Interpreter — server configuration (Phase 1).
 * Model default matches Meda low-cost pattern; override via INTERPRETER_OPENAI_MODEL.
 */

/** @type {Set<string>} */
export const INTERPRETER_SUPPORTED_LANGUAGE_CODES = new Set([
  "de",
  "en",
  "fr",
  "es",
  "it",
  "ru",
  "uk",
  "tr",
  "pt",
  "ar",
  "fa",
  "pl",
  "ro",
  "nl",
  "ckb",
  "ku",
  "el",
  "sq",
  "hr",
  "bs",
  "sr",
]);

export function getInterpreterOpenAiModel() {
  const model =
    process.env.INTERPRETER_OPENAI_MODEL || process.env.OPENAI_INTERPRETER_MODEL;
  return typeof model === "string" && model.trim() ? model.trim() : "gpt-4o-mini";
}

export function isInterpreterAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** One confirmed turn — no session history on the wire. */
export const INTERPRETER_MAX_TURN_CHARS = 1200;

/** Whisper transcript cap (aligned with turn limit). */
export const INTERPRETER_MAX_TRANSCRIPT_CHARS = 1200;

/** Reject empty or probe-sized uploads. */
export const INTERPRETER_MIN_AUDIO_BYTES = 400;

/** Short PTT clips only (stricter than generic /api/transcribe 10MB). */
export const INTERPRETER_MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export const INTERPRETER_ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/oga",
]);
