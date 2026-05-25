/**
 * Central OpenAI model defaults for MedScoutX.
 * Default chat/realtime: gpt-5.4 (override via OPENAI_CHAT_MODEL / OPENAI_DEFAULT_MODEL).
 *
 * Note: Realtime transcription and TTS use separate API models until gpt-5.4 equivalents exist.
 */

const DEFAULT_CHAT_MODEL = "gpt-5.4";

/** Chat Completions / Responses-style text+vision calls */
export function getOpenAiChatModel() {
  const env = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_DEFAULT_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_CHAT_MODEL;
}

/** Realtime speech-to-speech (Meda live translation) */
export function getOpenAiRealtimeModel() {
  const env =
    process.env.LIVE_TRANSLATION_REALTIME_MODEL || process.env.OPENAI_REALTIME_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_CHAT_MODEL;
}

/** Realtime input ASR (no gpt-5.4 transcribe SKU yet) */
export function getOpenAiTranscriptionModel() {
  const env =
    process.env.LIVE_TRANSLATION_TRANSCRIPTION_MODEL ||
    process.env.OPENAI_TRANSCRIPTION_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : "gpt-4o-transcribe";
}

/** OpenAI speech synthesis */
export function getOpenAiTtsModel() {
  const env = process.env.OPENAI_TTS_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : "gpt-4o-mini-tts";
}
