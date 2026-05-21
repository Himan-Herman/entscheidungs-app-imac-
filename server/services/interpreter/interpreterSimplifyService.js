import { openai } from "../../openaiClient.js";
import {
  getInterpreterOpenAiModel,
  isInterpreterAiConfigured,
} from "../../config/interpreterEnv.js";
import { AI_MODULES, normalizeUiLocale } from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput } from "../aiSafetySanitizer.js";
import {
  buildInterpreterSimplifySystemPrompt,
  buildInterpreterSimplifyUserMessage,
} from "./interpreterPrompt.js";
import { sanitizeInterpreterOutputText } from "./interpreterInputSafety.js";

const UNCLEAR_PREFIX = /^\[UNCLEAR\]\s*/i;

/**
 * @param {string} raw
 */
function postProcessSimplified(raw) {
  let text = String(raw ?? "").trim();
  const unclear = UNCLEAR_PREFIX.test(text);
  if (unclear) text = text.replace(UNCLEAR_PREFIX, "").trim();
  return { text, unclear };
}

/**
 * @param {{ text: string, language: string, speaker: string }} input
 */
export async function simplifyInterpreterText(input) {
  if (!isInterpreterAiConfigured()) {
    return {
      ok: false,
      code: "interpreter_unavailable",
      message: "Simplification is not configured. Please try again later.",
      statusCode: 503,
    };
  }

  const locale = normalizeUiLocale(input.language);
  const messages = [
    {
      role: "system",
      content: buildInterpreterSimplifySystemPrompt(input.language),
    },
    {
      role: "user",
      content: buildInterpreterSimplifyUserMessage(input),
    },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: getInterpreterOpenAiModel(),
      messages,
      max_tokens: 450,
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const processed = postProcessSimplified(raw);
    const safe = sanitizeAiOutput(processed.text, {
      module: AI_MODULES.MEDICAL_INTERPRETER,
      locale,
    });

    if (safe.used_fallback) {
      return {
        ok: false,
        error: "unsafe_medical_content",
        message:
          "This wording could not be simplified in a safe form. Please rephrase neutrally.",
        safety: {
          module: AI_MODULES.MEDICAL_INTERPRETER,
          blocked: true,
        },
        statusCode: 200,
      };
    }

    return {
      ok: true,
      simplifiedText: sanitizeInterpreterOutputText(safe.text),
      language: input.language,
      confidence: processed.unclear ? "low" : undefined,
      safety: {
        module: AI_MODULES.MEDICAL_INTERPRETER,
        blocked: false,
        communicationOnly: true,
      },
    };
  } catch {
    return {
      ok: false,
      code: "simplification_failed",
      message: "Simplification could not be completed. Please try again.",
      statusCode: 502,
    };
  }
}
