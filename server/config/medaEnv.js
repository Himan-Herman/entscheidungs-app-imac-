/**
 * Meda — lightweight knowledge assistant configuration.
 */
import { getOpenAiChatModel } from "./openAiModels.js";

export function getMedaOpenAiModel() {
  const model = process.env.MEDA_OPENAI_MODEL || process.env.OPENAI_MEDA_MODEL;
  return typeof model === "string" && model.trim() ? model.trim() : getOpenAiChatModel();
}

// isMedaEnabled moved to config/featureFlags.js in Phase 6a.2. It used to be
// Boolean(process.env.OPENAI_API_KEY) — the presence of somebody else's
// credential is not a decision to enable this feature.
export { isMedaEnabled } from "./featureFlags.js";

export const MEDA_MAX_INPUT_CHARS = 400;
export const MEDA_MAX_HISTORY_MESSAGES = 4;
export const MEDA_DAILY_QUESTION_LIMIT = 3;
export const MEDA_WINDOW_MS = 24 * 60 * 60 * 1000;
