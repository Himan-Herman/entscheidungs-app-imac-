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
