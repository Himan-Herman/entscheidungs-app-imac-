/**
 * Central OpenAI model defaults for MedScoutX.
 *
 * Layered model strategy:
 *  - Chat / text / medical translation / PDF:  gpt-5.4                  (OPENAI_CHAT_MODEL)
 *  - TTS / speech synthesis:                   gpt-4o-mini-tts           (OPENAI_TTS_MODEL)
 *  - Meda Realtime Live Interpreter:           gpt-4o-realtime-preview   (MEDA_REALTIME_MODEL → OPENAI_REALTIME_MODEL → "gpt-4o-realtime-preview")
 *  - Meda Realtime transcription:              gpt-4o-transcribe         (MEDA_REALTIME_TRANSCRIPTION_MODEL)
 *  - Meda Realtime voice:                      marin                     (LIVE_TRANSLATION_VOICE)
 *  - Meda Realtime VAD silence:                1500 ms                   (LIVE_TRANSLATION_VAD_SILENCE_MS)
 */

const DEFAULT_CHAT_MODEL = "gpt-5.4";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";

/** Chat Completions / Responses-style text reasoning, medical translation, PDF structuring. */
export function getOpenAiChatModel() {
  const env = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_DEFAULT_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_CHAT_MODEL;
}

/**
 * Medical live translation — isolated model slot.
 * Override via MEDA_TRANSLATION_MODEL; falls back to the shared chat model so
 * Render deployments that have not set the new var keep working unchanged.
 */
export function getMedaTranslationModel() {
  const env = process.env.MEDA_TRANSLATION_MODEL;
  if (typeof env === "string" && env.trim()) return env.trim();
  return getOpenAiChatModel();
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
 * Meda Realtime Live Interpreter — OpenAI Realtime API model.
 * Lookup order: MEDA_REALTIME_MODEL → OPENAI_REALTIME_MODEL → "gpt-realtime"
 */
export function getMedaRealtimeModel() {
  const primary   = process.env.MEDA_REALTIME_MODEL;
  const secondary = process.env.OPENAI_REALTIME_MODEL;
  if (typeof primary   === "string" && primary.trim())   return primary.trim();
  if (typeof secondary === "string" && secondary.trim()) return secondary.trim();
  return "gpt-4o-realtime-preview";
}

/**
 * Meda Realtime transcription model (Whisper-based, auto language detection).
 * Override via MEDA_REALTIME_TRANSCRIPTION_MODEL env var.
 */
export function getMedaRealtimeTranscriptionModel() {
  const env = process.env.MEDA_REALTIME_TRANSCRIPTION_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : "gpt-4o-transcribe";
}

/**
 * Voice for Meda Realtime audio output.
 * Override via LIVE_TRANSLATION_VOICE env var.
 * Fallback: "marin" (default for gpt-4o-realtime-preview and gpt-realtime).
 */
export function getLiveTranslationVoice() {
  const env = process.env.LIVE_TRANSLATION_VOICE;
  return typeof env === "string" && env.trim() ? env.trim() : "marin";
}

/**
 * Server-VAD silence duration in milliseconds.
 * Override via LIVE_TRANSLATION_VAD_SILENCE_MS env var.
 * Clamped to [500, 2000]. Default: 1500 ms.
 * 1500 ms gives medical speakers time for natural pauses within a sentence.
 */
export function getLiveTranslationVadSilenceMs() {
  const raw = parseInt(process.env.LIVE_TRANSLATION_VAD_SILENCE_MS ?? "", 10);
  if (!Number.isFinite(raw)) return 1500;
  return Math.max(500, Math.min(2000, raw));
}
