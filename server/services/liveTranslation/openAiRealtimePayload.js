/**
 * OpenAI Realtime client_secrets payload helpers.
 * Keeps transcription language / voice / model within API-supported values.
 */

/** ISO codes accepted by Realtime input transcription (from OpenAI API error list). */
export const OPENAI_TRANSCRIPTION_LANGUAGE_CODES = new Set([
  "af", "ar", "az", "be", "bg", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", "fa",
  "fi", "fr", "gl", "he", "hi", "hr", "hu", "hy", "id", "is", "it", "iw", "ja", "kk", "kn", "ko",
  "lt", "lv", "mi", "mk", "mr", "ms", "ne", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sr",
  "sv", "sw", "ta", "th", "tl", "tr", "uk", "ur", "vi", "zh",
]);

export const OPENAI_REALTIME_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar",
]);

export const OPENAI_TRANSCRIPTION_MODELS = new Set([
  "whisper-1",
  "gpt-realtime-whisper",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
  "gpt-4o-mini-transcribe-2025-03-20",
  "gpt-4o-mini-transcribe-2025-12-15",
]);

/** @param {string | undefined | null} code */
export function resolveOpenAiTranscriptionLanguage(code) {
  if (typeof code !== "string") return null;
  const normalized = code.trim().toLowerCase();
  return OPENAI_TRANSCRIPTION_LANGUAGE_CODES.has(normalized) ? normalized : null;
}

/** @param {string | undefined | null} voice */
export function resolveOpenAiRealtimeVoice(voice, fallback = "marin") {
  if (typeof voice === "string" && OPENAI_REALTIME_VOICES.has(voice)) return voice;
  return fallback;
}

/** @param {string | undefined | null} model */
export function resolveOpenAiTranscriptionModel(model, fallback = "gpt-4o-mini-transcribe") {
  if (typeof model === "string" && OPENAI_TRANSCRIPTION_MODELS.has(model)) return model;
  return fallback;
}

/** @param {unknown} raw @param {number} fallback */
export function safeIntegerEnv(raw, fallback) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.round(value);
}
