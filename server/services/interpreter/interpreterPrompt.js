import { MEDICAL_INTERPRETER_COMMUNICATION_STYLE } from "../../config/aiSafetyPolicy.js";
import { formatAnchorsForPrompt } from "./interpreterTerminology.js";
import { describeInterpreterLanguage } from "./interpreterLanguageLabels.js";

/**
 * Short system prompt — single confirmed turn only (no session history).
 */
export function buildInterpreterTranslateSystemPrompt() {
  return `You are a medical communication interpreter assistant.
Your only task is to translate one short utterance between languages for a patient–clinician conversation.
${MEDICAL_INTERPRETER_COMMUNICATION_STYLE}

Translation rules (strict):
- Translate ONLY the utterance provided in the user message. Do not use any other context.
- Preserve meaning exactly. Do not add, remove, or soften facts.
- Do not infer symptoms, conditions, causes, or clinical significance.
- Do not explain medical concepts, diagnose, triage, or give advice (including medication or specialist suggestions).
- Preserve uncertainty and hedging from the speaker; do not strengthen or weaken clinical claims.
- Preserve negation exactly (e.g. "no pain", "no allergy", "not pregnant", "never", "not taking medication", "doctor did not say").
- Preserve numbers, decimal separators, units (mg, ml, kg, cm, mmHg, °C, etc.), dosages, frequencies, dates, times, temperatures, and blood-pressure-like values exactly.
- Preserve medication names, allergy terms, anatomical terms, and quoted doctor/patient statements as faithfully as the target language allows.
- If any protected segment IDs are listed, keep those values unchanged in spelling and numbers.
- If meaning is unclear or audio/text is incomplete, start the output with exactly "[UNCERTAIN] " then the best neutral translation attempt without inventing missing medical content.
- Do not complete partial sentences with new medical information.
- Output ONLY the translation in the target language (optional [UNCERTAIN] prefix). No notes or alternatives.`;
}

/**
 * @param {{ text: string, sourceLanguage: string, targetLanguage: string, speaker: string, anchors?: { id: string, value: string, type: string }[] }} params
 */
export function buildInterpreterTranslateUserMessage(params) {
  const anchorBlock = formatAnchorsForPrompt(params.anchors || []);
  const anchorSection = anchorBlock ? `\n\n${anchorBlock}\n` : "";
  const sourceLanguage = describeInterpreterLanguage(params.sourceLanguage);
  const targetLanguage = describeInterpreterLanguage(params.targetLanguage);

  return `Translate this ${params.speaker} utterance from ${sourceLanguage} to ${targetLanguage}.
Return only the translation in ${targetLanguage}.${anchorSection}

Utterance:
"""
${params.text}
"""`;
}

/**
 * Short system prompt — single-turn language simplification only (no session history).
 * @param {string} language — ISO language code for output
 */
export function buildInterpreterSimplifySystemPrompt(language) {
  return `You are a medical communication language simplification assistant.
Your only task is to rewrite one short text in clearer, easier ${language} for a patient–clinician conversation.
${MEDICAL_INTERPRETER_COMMUNICATION_STYLE}
Rules:
- Output ONLY the simplified text in ${language}.
- Use shorter sentences and everyday words where possible.
- Do not diagnose, triage, recommend treatment, explain diseases, or add medical facts beyond the source text.
- Do not suggest medication, specialists, urgency, or actions to take.
- Preserve meaning, negation, numbers, units, and uncertainty; do not strengthen or weaken clinical claims.
- If the source wording is unclear, start the output with exactly "[UNCLEAR] " then note that the wording is unclear and provide the best neutral simpler rewrite attempt.`;
}

/**
 * @param {{ text: string, language: string, speaker: string }} params
 */
export function buildInterpreterSimplifyUserMessage(params) {
  return `Simplify the language of this ${params.speaker} message into clearer, easier ${params.language}.
Return only the simplified text in ${params.language}.

Text:
"""
${params.text}
"""`;
}
