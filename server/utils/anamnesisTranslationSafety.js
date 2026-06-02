/**
 * Safety utilities for anamnesis translation output.
 * Delegates to the central AI safety sanitizer with the ANAMNESIS_TRANSLATION module.
 */

import { AI_MODULES } from "../config/aiSafetyPolicy.js";
import { detectForbiddenMedicalClaims } from "../services/aiSafetySanitizer.js";

/** Max characters accepted per answer before we skip AI translation for that item. */
export const ANAMNESIS_TRANSLATION_MAX_CHARS_PER_ANSWER = 1000;

/** Max total characters across all answers sent in one API call. */
export const ANAMNESIS_TRANSLATION_MAX_TOTAL_CHARS = 6000;

/** Max answers per batch (one API call). */
export const ANAMNESIS_TRANSLATION_BATCH_SIZE = 20;

/** API timeout in milliseconds. */
export const ANAMNESIS_TRANSLATION_TIMEOUT_MS = 30_000;

/** Max tokens for the translation response. */
export const ANAMNESIS_TRANSLATION_MAX_TOKENS = 2500;

/**
 * Returns true if a translated text contains forbidden medical content.
 * When this triggers the item gets marked uncertain=true and translatedText is nulled.
 */
export function translatedTextIsSafe(text) {
  if (typeof text !== "string" || !text.trim()) return true;
  const { unsafe } = detectForbiddenMedicalClaims(text, AI_MODULES.ANAMNESIS_TRANSLATION);
  return !unsafe;
}

/**
 * Parses raw JSON string from the model into an array of translation objects.
 * Returns null if parsing fails or structure is unexpected.
 *
 * @param {string} raw
 * @returns {{ questionId: string, translatedText: string|null, uncertain: boolean, notes: string[] }[] | null}
 */
export function parseTranslationResponse(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;

  // Strip accidental markdown code fences the model might add
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  return parsed.map((item) => ({
    questionId: typeof item.questionId === "string" ? item.questionId : "",
    sourceLanguage: typeof item.sourceLanguage === "string" ? item.sourceLanguage : "",
    targetLanguage: typeof item.targetLanguage === "string" ? item.targetLanguage : "",
    originalText: typeof item.originalText === "string" ? item.originalText : "",
    translatedText: typeof item.translatedText === "string" ? item.translatedText : null,
    uncertain: Boolean(item.uncertain),
    notes: Array.isArray(item.notes) ? item.notes.filter((n) => typeof n === "string") : [],
  }));
}

/**
 * Determines whether an answer item should be sent to the AI for translation.
 * - Skips null/boolean/number-only values (yes_no, pure number answers)
 * - Skips empty strings
 * - Skips values exceeding max length
 *
 * @param {{ type: string, value: unknown }} item
 */
export function isTranslatableAnswer(item) {
  const { type, value } = item;
  if (value === null || value === undefined || value === "") return false;
  if (type === "yes_no") return false;   // booleans don't need translation
  if (type === "number") return false;   // numbers don't need translation
  if (type === "date") return false;     // dates don't need translation

  const text = Array.isArray(value) ? value.join(", ") : String(value);
  if (!text.trim()) return false;
  if (text.length > ANAMNESIS_TRANSLATION_MAX_CHARS_PER_ANSWER) return false;

  return true;
}

/**
 * Converts a multi-choice array value to a string for translation.
 */
export function answerToTranslatableText(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
