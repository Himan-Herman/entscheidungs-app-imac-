/**
 * Central OpenAI model defaults for MedScoutX.
 *
 * Layered model strategy:
 *  - Chat / text / medical translation / PDF:  gpt-5.4        (OPENAI_CHAT_MODEL)
 *  - Realtime audio / WebRTC (Meda live):      gpt-4o-realtime-preview (LIVE_TRANSLATION_REALTIME_MODEL)
 *    ↳ GPT-5.4 is NOT valid for the Realtime API; using it causes invalid_value errors.
 *  - ASR / speech-to-text:                     gpt-4o-transcribe (LIVE_TRANSLATION_TRANSCRIPTION_MODEL)
 *  - TTS / speech synthesis:                   gpt-4o-mini-tts   (OPENAI_TTS_MODEL)
 *  - TTS voice (Meda, interpreter):            marin             (LIVE_TRANSLATION_VOICE)
 *    ↳ Calm, neutral, professional — suitable for healthcare communication.
 */

const DEFAULT_CHAT_MODEL = "gpt-5.4";
const DEFAULT_REALTIME_MODEL = "gpt-4o-realtime-preview";
const DEFAULT_DEV_REALTIME_MODEL = "gpt-realtime-mini-2025-10-06";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-transcribe";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_VOICE = "marin";

/** Chat Completions / Responses-style text reasoning, medical translation, PDF structuring. */
export function getOpenAiChatModel() {
  const env = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_DEFAULT_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_CHAT_MODEL;
}

/**
 * Realtime WebRTC audio model (Meda live translation).
 * Must be an official OpenAI Realtime model — NOT a chat model.
 * Override via LIVE_TRANSLATION_REALTIME_MODEL env var.
 */
export function getOpenAiRealtimeModel() {
  const env =
    process.env.LIVE_TRANSLATION_REALTIME_MODEL || process.env.OPENAI_REALTIME_MODEL;
  if (typeof env === "string" && env.trim()) return env.trim();
  if (process.env.NODE_ENV === "development") return DEFAULT_DEV_REALTIME_MODEL;
  return DEFAULT_REALTIME_MODEL;
}

/**
 * ASR/transcription model for Realtime input audio.
 * gpt-4o-transcribe gives the highest medical speech accuracy.
 * Override via LIVE_TRANSLATION_TRANSCRIPTION_MODEL env var.
 */
export function getOpenAiTranscriptionModel() {
  const env =
    process.env.LIVE_TRANSLATION_TRANSCRIPTION_MODEL ||
    process.env.OPENAI_TRANSCRIPTION_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_TRANSCRIPTION_MODEL;
}

/**
 * TTS model for speech synthesis (routes/tts, interpreter).
 * Override via OPENAI_TTS_MODEL env var.
 */
export function getOpenAiTtsModel() {
  const env = process.env.OPENAI_TTS_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_TTS_MODEL;
}

/**
 * TTS voice — calm, neutral, professional for healthcare communication.
 * Override via LIVE_TRANSLATION_VOICE env var (shared with Realtime voice).
 */
export function getOpenAiTtsVoice() {
  const env = process.env.LIVE_TRANSLATION_VOICE || process.env.OPENAI_TTS_VOICE;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_TTS_VOICE;
}
