/**
 * OpenAI Realtime client_secrets payload helpers.
 * Keeps transcription language / voice / model within API-supported values.
 *
 * Model separation:
 *  - Realtime (WebRTC/audio): gpt-realtime-2 — official low-latency audio model.
 *    GPT-5.4 is a chat/text model and is NOT valid here; using it causes invalid_value errors.
 *  - Transcription (ASR): gpt-4o-transcribe — best accuracy for medical speech.
 *  - TTS/voice: marin — calm, neutral, professional; suitable for healthcare.
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

/**
 * Valid OpenAI Realtime audio/WebRTC models.
 * GPT-5.4 is intentionally excluded — it is a chat/text model, not a Realtime audio model.
 * Using a chat model here causes invalid_value errors from the client_secrets endpoint.
 */
export const OPENAI_REALTIME_MODELS = new Set([
  "gpt-realtime",
  "gpt-realtime-2",
  "gpt-4o-realtime-preview",
  "gpt-4o-realtime-preview-2024-12-17",
  "gpt-4o-mini-realtime-preview",
]);

/**
 * Valid OpenAI ASR/transcription models.
 * gpt-4o-transcribe is preferred for medical use (highest accuracy).
 * gpt-4o-mini-transcribe is the lighter fallback.
 */
export const OPENAI_TRANSCRIPTION_MODELS = new Set([
  "whisper-1",
  "gpt-realtime-whisper",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-2025-03-20",
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
export function resolveOpenAiRealtimeModel(model, fallback = "gpt-realtime-2") {
  if (typeof model === "string" && OPENAI_REALTIME_MODELS.has(model)) return model;
  return fallback;
}

/** @param {string | undefined | null} model */
export function resolveOpenAiTranscriptionModel(model, fallback = "gpt-4o-transcribe") {
  if (typeof model === "string" && OPENAI_TRANSCRIPTION_MODELS.has(model)) return model;
  return fallback;
}

/** @param {unknown} raw @param {number} fallback */
export function safeIntegerEnv(raw, fallback) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.round(value);
}
