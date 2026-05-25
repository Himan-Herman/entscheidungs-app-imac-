/**
 * Meda — lightweight knowledge assistant configuration.
 */
import { getOpenAiChatModel } from "./openAiModels.js";

export function getMedaOpenAiModel() {
  const model = process.env.MEDA_OPENAI_MODEL || process.env.OPENAI_MEDA_MODEL;
  return typeof model === "string" && model.trim() ? model.trim() : getOpenAiChatModel();
}

export function isMedaEnabled() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export const MEDA_MAX_INPUT_CHARS = 400;
export const MEDA_MAX_HISTORY_MESSAGES = 4;
export const MEDA_DAILY_QUESTION_LIMIT = 3;
export const MEDA_WINDOW_MS = 24 * 60 * 60 * 1000;
