import OpenAI from "openai";
import { getMedaOpenAiModel, isMedaEnabled, MEDA_MAX_HISTORY_MESSAGES } from "../../config/medaEnv.js";
import { buildMedaSystemPrompt } from "./medaPrompt.js";
import { validateMedaInput } from "./medaInputSafety.js";
import { getMedaQuota, recordMedaQuestion } from "./medaRateLimit.js";
import { sanitizeAiOutput } from "../aiSafetySanitizer.js";
import { AI_MODULES } from "../../config/aiSafetyPolicy.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DIAGNOSIS_REFUSAL = {
  de: "Ich kann keine Diagnose stellen. Bitte wende dich bei medizinischen Beschwerden an medizinisches Fachpersonal.",
  en: "I cannot provide a diagnosis. Please contact healthcare professionals for medical concerns.",
};

/**
 * @param {string} userId
 * @param {{ message: string, history?: { role: string, content: string }[], locale?: string }} input
 */
export async function runMedaChat(userId, input) {
  if (!isMedaEnabled()) {
    return { ok: false, code: "meda_unavailable" };
  }

  const locale = input.locale === "en" ? "en" : "de";
  const quota = getMedaQuota(userId);
  if (!quota.ok) {
    return { ok: false, code: "rate_limit_exceeded", quota };
  }

  const validated = validateMedaInput(input.message);
  if (!validated.ok) {
    return { ok: false, code: validated.code };
  }

  if (validated.diagnosisAttempt) {
    return {
      ok: true,
      reply: DIAGNOSIS_REFUSAL[locale],
      quota: getMedaQuota(userId),
      refused: true,
    };
  }

  const history = (input.history || [])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim(),
    )
    .slice(-MEDA_MAX_HISTORY_MESSAGES);

  const messages = [
    { role: "system", content: buildMedaSystemPrompt(locale) },
    ...history.map((m) => ({ role: m.role, content: m.content.trim() })),
    { role: "user", content: validated.text },
  ];

  const completion = await openai.chat.completions.create({
    model: getMedaOpenAiModel(),
    messages,
    max_tokens: 220,
    temperature: 0.35,
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  const safe = sanitizeAiOutput(raw, { module: AI_MODULES.MEDA, locale });

  const updatedQuota = recordMedaQuestion(userId);

  return {
    ok: true,
    reply: safe.text,
    quota: updatedQuota,
    refused: false,
  };
}

/**
 * @param {string} userId
 */
export function getMedaStatus(userId) {
  return {
    ok: true,
    enabled: isMedaEnabled(),
    quota: getMedaQuota(userId),
  };
}
