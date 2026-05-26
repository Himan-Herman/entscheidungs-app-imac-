/**
 * AI helpers for Health History — DSGVO-safe (no PII in prompts).
 *
 * POST /api/patient/health-history/ai/severity-suggest
 *   Body: { reactionText: string }  — clinical symptom text only, no patient identifiers
 *   Response: { severity: "mild"|"moderate"|"severe"|"life_threatening", explanation: string }
 *
 * POST /api/patient/health-history/ai/icd-suggest
 *   Body: { conditionText: string }  — condition name only, no patient identifiers
 *   Response: { icdCode: string, icdLabel: string }
 */

import express from "express";
import OpenAI from "openai";
import { isHealthHistoryEnabled } from "../config/featureFlags.js";
import { getOpenAiChatModel } from "../config/openAiModels.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function requireFeature(_req, res, next) {
  if (!isHealthHistoryEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

/**
 * POST /severity-suggest
 * Suggests allergy severity based on anonymised reaction description.
 * Only the clinical text is sent — never patient name, DOB, or any identifier.
 */
router.post("/severity-suggest", requireFeature, async (req, res) => {
  const { reactionText } = req.body || {};
  if (!reactionText || typeof reactionText !== "string" || reactionText.trim().length < 3) {
    return res.status(400).json({ ok: false, error: "invalid_input" });
  }

  const text = reactionText.trim().slice(0, 500);

  try {
    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      messages: [
        {
          role: "system",
          content: `You are a clinical classification assistant. Classify allergy reaction severity from the user's symptom description.
Return ONLY valid JSON with keys: severity (one of: mild, moderate, severe, life_threatening) and a short explanation (1 sentence, max 80 chars, in the same language as the input).
Do not diagnose. Do not add medical advice. Do not include any personal information. Only classify the described symptoms.`,
        },
        {
          role: "user",
          content: `Symptom description: "${text}"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 120,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content || "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const valid = ["mild", "moderate", "severe", "life_threatening"];
    const severity = valid.includes(parsed.severity) ? parsed.severity : null;

    if (!severity) {
      return res.status(422).json({ ok: false, error: "classification_failed" });
    }

    return res.json({ ok: true, severity, explanation: parsed.explanation || "" });
  } catch (err) {
    logServerError("healthHistoryAi/severity-suggest", err);
    return res.status(500).json({ ok: false, error: "ai_unavailable" });
  }
});

/**
 * POST /icd-suggest
 * Suggests ICD-10 code from an anonymised condition name.
 * Only the condition name text is sent — no patient identifiers.
 */
router.post("/icd-suggest", requireFeature, async (req, res) => {
  const { conditionText } = req.body || {};
  if (!conditionText || typeof conditionText !== "string" || conditionText.trim().length < 2) {
    return res.status(400).json({ ok: false, error: "invalid_input" });
  }

  const text = conditionText.trim().slice(0, 300);

  try {
    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      messages: [
        {
          role: "system",
          content: `You are a medical coding assistant for ICD-10-GM (German version, also valid internationally).
Given a condition name, return ONLY valid JSON with: icdCode (string, ICD-10 code like "E11" or "I10") and icdLabel (string, official short name in the same language as the input, max 80 chars).
If no ICD-10 code is clearly applicable, return {"icdCode": null, "icdLabel": null}.
Do not diagnose. Do not add recommendations. Only provide the code.`,
        },
        {
          role: "user",
          content: `Condition: "${text}"`,
        },
      ],
      temperature: 0.0,
      max_tokens: 80,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content || "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return res.json({
      ok: true,
      icdCode: parsed.icdCode || null,
      icdLabel: parsed.icdLabel || null,
    });
  } catch (err) {
    logServerError("healthHistoryAi/icd-suggest", err);
    return res.status(500).json({ ok: false, error: "ai_unavailable" });
  }
});

export default router;
