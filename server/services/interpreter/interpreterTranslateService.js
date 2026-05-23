import { openai } from "../../openaiClient.js";
import {
  getInterpreterOpenAiModel,
  isInterpreterAiConfigured,
} from "../../config/interpreterEnv.js";
import { AI_MODULES, normalizeUiLocale } from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput } from "../aiSafetySanitizer.js";
import {
  buildInterpreterTranslateSystemPrompt,
  buildInterpreterTranslateUserMessage,
} from "./interpreterPrompt.js";
import { sanitizeInterpreterOutputText } from "./interpreterInputSafety.js";
import {
  assessTranslationQuality,
  buildTranslationDirection,
  extractProtectedAnchors,
  stripUncertainPrefix,
} from "./interpreterTerminology.js";

/**
 * @param {{
 *   text: string;
 *   sourceLanguage: string;
 *   targetLanguage: string;
 *   speaker: string;
 * }} input
 */
export async function translateInterpreterTurn(input) {
  if (!isInterpreterAiConfigured()) {
    return {
      ok: false,
      code: "interpreter_unavailable",
      message: "Translation is not configured. Please try again later.",
      statusCode: 503,
    };
  }

  const locale = normalizeUiLocale(input.targetLanguage);
  const anchors = extractProtectedAnchors(input.text);
  const messages = [
    { role: "system", content: buildInterpreterTranslateSystemPrompt() },
    {
      role: "user",
      content: buildInterpreterTranslateUserMessage({
        ...input,
        anchors,
      }),
    },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: getInterpreterOpenAiModel(),
      messages,
      max_tokens: 450,
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const processed = stripUncertainPrefix(raw);
    const safe = sanitizeAiOutput(processed.text, {
      module: AI_MODULES.MEDICAL_INTERPRETER,
      locale,
    });

    if (safe.used_fallback) {
      return {
        ok: false,
        error: "unsafe_medical_content",
        message:
          "Translation could not be shown in a safe form. Please rephrase neutrally.",
        statusCode: 200,
      };
    }

    const translatedText = sanitizeInterpreterOutputText(safe.text);
    const quality = assessTranslationQuality({
      sourceText: input.text,
      translatedText,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      anchors,
      modelUncertain: processed.uncertain,
    });

    const confidence =
      quality.uncertain || quality.terminologyWarning ? "low" : undefined;

    return {
      ok: true,
      translatedText,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      translationDirection: buildTranslationDirection(
        input.sourceLanguage,
        input.targetLanguage,
      ),
      confidence,
      uncertain: quality.uncertain,
      terminologyWarning: quality.terminologyWarning,
      unclearSource: quality.unclearSource,
      negationRisk: quality.negationRisk,
    };
  } catch {
    return {
      ok: false,
      code: "translation_failed",
      message: "Translation could not be completed. Please try again.",
      statusCode: 502,
    };
  }
}
