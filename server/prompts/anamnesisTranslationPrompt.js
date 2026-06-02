/**
 * Prompt builder for the anamnesis answer translation service.
 *
 * Scope: strict translation only. The AI must not add, interpret,
 * diagnose, triage, or summarise — it must only translate the given text.
 */

/**
 * @param {string} sourceLang  — BCP-47 code, e.g. "tr"
 * @param {string} targetLang  — BCP-47 code, e.g. "de"
 */
export function buildAnamnesisTranslationSystemPrompt(sourceLang, targetLang) {
  return `You are a translation service. Your only task is to translate patient-provided text from ${sourceLang} to ${targetLang}.

Strict rules:
- Translate ONLY the text provided. Do not add, remove, reinterpret, or paraphrase content beyond faithful translation.
- Do NOT add diagnoses, therapy recommendations, urgency ratings, triage assessments, medical interpretations, warnings, or any new medical content.
- Do NOT invent information that is not present in the source text.
- If the source text is unclear or ambiguous, translate the ambiguity as faithfully as possible without resolving it.
- Preserve medical terms, negations ("no", "not", "never", "none"), numbers, units (mg, ml, kg, mmHg, °C), dosages, frequencies, dates, and quoted expressions as faithfully as the target language allows.
- Preserve the patient's own wording and level of certainty; do not strengthen or weaken claims.
- If a text entry is empty, null, or a simple boolean placeholder, return translatedText as null.
- Set uncertain=true only if the source text is genuinely unintelligible, contains mixed languages, or you cannot produce a reliable translation.

Output format: return ONLY a valid JSON array — no prose, no markdown code fences.
Each element must have exactly these fields:
{
  "questionId": "<same questionId as input>",
  "sourceLanguage": "${sourceLang}",
  "targetLanguage": "${targetLang}",
  "originalText": "<exact copy of the source text>",
  "translatedText": "<translation, or null if empty/untranslatable>",
  "uncertain": false,
  "notes": []
}`;
}

/**
 * @param {{ questionId: string, questionLabel: string, value: string }[]} items
 * @param {string} sourceLang
 * @param {string} targetLang
 */
export function buildAnamnesisTranslationUserMessage(items, sourceLang, targetLang) {
  const payload = items.map((item) => ({
    questionId: item.questionId,
    questionLabel: item.questionLabel,
    text: item.value,
  }));

  return `Translate the following patient answers from ${sourceLang} to ${targetLang}.

Input:
${JSON.stringify(payload, null, 2)}

Return a JSON array with one object per input item, using the exact output format from the system instructions. Return ONLY the JSON array.`;
}
