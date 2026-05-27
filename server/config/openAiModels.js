/**
 * Central OpenAI model defaults for MedScoutX.
 *
 * Layered model strategy:
 *  - Chat / text / medical translation / PDF:  gpt-5.4        (OPENAI_CHAT_MODEL)
 *  - TTS / speech synthesis:                   gpt-4o-mini-tts   (OPENAI_TTS_MODEL)
 */

const DEFAULT_CHAT_MODEL = "gpt-5.4";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";

/** Chat Completions / Responses-style text reasoning, medical translation, PDF structuring. */
export function getOpenAiChatModel() {
  const env = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_DEFAULT_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_CHAT_MODEL;
}

/**
 * TTS model for speech synthesis (routes/tts, interpreter).
 * Override via OPENAI_TTS_MODEL env var.
 */
export function getOpenAiTtsModel() {
  const env = process.env.OPENAI_TTS_MODEL;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_TTS_MODEL;
}
