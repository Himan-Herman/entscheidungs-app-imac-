/**
 * OpenAI Realtime API payload helpers.
 *
 * Schema source: openai/openai-openapi (RealtimeSessionCreateRequestGA)
 * Both POST /v1/realtime/client_secrets and session.update WebSocket event use flat session fields:
 * voice, input_audio_transcription, turn_detection at session root — not nested under audio.input/output.
 * The nested structure is in the spec but rejected by the current production endpoint.
 *
 * Model separation (all per official OpenAI API spec):
 *  - Realtime (WebRTC/audio): gpt-4o-realtime-preview — officially documented model.
 *    GPT-5.4 is a chat/text model and MUST NOT be used here.
 *  - Transcription (ASR):     gpt-4o-transcribe — highest medical accuracy.
 *  - TTS:                     gpt-4o-mini-tts
 *  - Voice:                   marin or cedar (recommended by OpenAI for quality)
 */

/** ISO-639-1 codes accepted by input_audio_transcription.language */
export const OPENAI_TRANSCRIPTION_LANGUAGE_CODES = new Set([
  "af", "ar", "az", "be", "bg", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", "fa",
  "fi", "fr", "gl", "he", "hi", "hr", "hu", "hy", "id", "is", "it", "iw", "ja", "kk", "kn", "ko",
  "lt", "lv", "mi", "mk", "mr", "ms", "ne", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sr",
  "sv", "sw", "ta", "th", "tl", "tr", "uk", "ur", "vi", "zh",
]);

/** Built-in voices from VoiceIdsOrCustomVoice schema */
export const OPENAI_REALTIME_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar",
]);

/**
 * Valid Realtime WebRTC audio models from OpenAI spec.
 * Chat/text models (gpt-5.4, gpt-4o, etc.) are intentionally excluded —
 * they cause invalid_value errors at the client_secrets endpoint.
 */
export const OPENAI_REALTIME_MODELS = new Set([
  "gpt-realtime",
  "gpt-realtime-1.5",
  "gpt-realtime-2",
  "gpt-realtime-2025-08-28",
  "gpt-4o-realtime-preview",
  "gpt-4o-realtime-preview-2024-10-01",
  "gpt-4o-realtime-preview-2024-12-17",
  "gpt-4o-realtime-preview-2025-06-03",
  "gpt-4o-mini-realtime-preview",
  "gpt-4o-mini-realtime-preview-2024-12-17",
  "gpt-realtime-mini",
  "gpt-realtime-mini-2025-10-06",
  "gpt-realtime-mini-2025-12-15",
  "gpt-audio-1.5",
  "gpt-audio-mini",
  "gpt-audio-mini-2025-10-06",
  "gpt-audio-mini-2025-12-15",
]);

/**
 * Valid ASR models from AudioTranscription schema.
 * gpt-4o-transcribe is preferred for medical use (highest accuracy).
 */
export const OPENAI_TRANSCRIPTION_MODELS = new Set([
  "whisper-1",
  "gpt-realtime-whisper",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
  "gpt-4o-mini-transcribe",
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
export function resolveOpenAiRealtimeModel(model, fallback = "gpt-4o-realtime-preview") {
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
