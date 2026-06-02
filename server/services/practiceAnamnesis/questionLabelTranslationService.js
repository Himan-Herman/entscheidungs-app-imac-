/**
 * Question-label translation service for the public anamnesis intake.
 *
 * Translates medical-form question labels and hints into the patient's language
 * BEFORE the form is shown.  Only the question text and target language are sent
 * to the AI — never patient names, dates of birth, insurance data, or IDs.
 *
 * This is intentionally a lightweight, synchronous-on-demand service (called from
 * the request handler, not fire-and-forget), because the patient is waiting for
 * the result before they can fill in the form.
 */

import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from "../../config/openAiModels.js";
import { buildAnamnesisTranslationSystemPrompt } from "../../prompts/anamnesisTranslationPrompt.js";

const MAX_LABELS_PER_REQUEST = 60;
const MAX_LABEL_TEXT_CHARS = 300;
const TIMEOUT_MS = 20_000;
const MAX_TOKENS = 1800;

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Translates an array of question labels/hints into the target language.
 *
 * @param {{ id: string, text: string }[]} items  Each item has a synthetic id (e.g. "label:<questionId>") and the source text.
 * @param {string} targetLang  BCP-47 code, e.g. "tr"
 * @param {string} [sourceLang]  BCP-47 code of the source text, default "de"
 * @returns {Promise<{ id: string, translatedText: string|null }[]|null>}
 *   Null if AI is unavailable or translation failed; caller falls back to original text.
 */
export async function translateQuestionLabels(items, targetLang, sourceLang = "de") {
  if (!isConfigured()) return null;
  if (!items?.length || !targetLang) return null;
  if (sourceLang === targetLang) return items.map((l) => ({ id: l.id, translatedText: l.text }));

  const safeItems = items
    .slice(0, MAX_LABELS_PER_REQUEST)
    .map((l) => ({ id: String(l.id || "").slice(0, 100), text: String(l.text || "").slice(0, MAX_LABEL_TEXT_CHARS) }))
    .filter((l) => l.id && l.text.trim());

  if (!safeItems.length) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const systemPrompt = buildAnamnesisTranslationSystemPrompt(sourceLang, targetLang);

    const payload = safeItems.map((l) => ({
      questionId: l.id,
      questionLabel: l.text,
      text: l.text,
    }));

    const userMessage = `Translate the following medical form labels from ${sourceLang} to ${targetLang}. These are question labels shown to patients — translate faithfully and concisely.

Input:
${JSON.stringify(payload, null, 2)}

Return ONLY a valid JSON array using the format from the system instructions.`;

    const completion = await openai.chat.completions.create(
      {
        model: getOpenAiChatModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
        max_tokens: MAX_TOKENS,
      },
      { signal: controller.signal },
    );

    const raw = (completion.choices[0]?.message?.content || "").trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

    let parsed;
    try { parsed = JSON.parse(cleaned); } catch { return null; }
    if (!Array.isArray(parsed)) return null;

    return parsed
      .map((item) => ({
        id: typeof item.questionId === "string" ? item.questionId : "",
        translatedText: typeof item.translatedText === "string" ? item.translatedText : null,
        uncertain: Boolean(item.uncertain),
      }))
      .filter((item) => item.id);
  } catch (err) {
    if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
      console.warn("[questionLabelTranslation] API timeout");
    } else {
      console.warn("[questionLabelTranslation] API error:", err?.message);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
