/**
 * Patient-facing plain-language explanations of lab values.
 *
 * Scope: explain what a parameter measures + note whether the value is within or outside
 * the documented reference range. No diagnosis, no urgency, no treatment advice.
 */

import { openai } from "../../openaiClient.js";
import {
  AI_MODULES,
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { getPatientStructuredDocument } from "./documentOcrService.js";
import { isLabPatientExplanationEnabled } from "../../config/featureFlags.js";

const MAX_ENTRIES = 40;

const OVERALL_DISCLAIMER = {
  de: "Diese Erklärungen sind allgemeine Informationen und ersetzen keine ärztliche Beratung. Bitte besprechen Sie Ihre Laborwerte mit Ihrem Arzt oder Ihrer Ärztin.",
  en: "These explanations are general information and do not replace medical advice. Please discuss your lab results with your doctor.",
};

const SYSTEM_PROMPT = `You are a patient information assistant. Your only task is to help patients understand what individual lab parameters measure and whether their result falls within or outside the documented reference range.

Allowed:
- Explain in 1–2 plain sentences what the parameter measures (e.g. "Hämoglobin ist ein Protein in den roten Blutkörperchen, das Sauerstoff im Blut transportiert.")
- State clearly whether the value is within the reference range, below it, or above it, using the reference range from the input
- End every explanation with: "Bitte sprechen Sie mit Ihrem Arzt über dieses Ergebnis." (DE) or "Please speak with your doctor about this result." (EN)
- If no reference range is provided, omit the in-range assessment

Strictly forbidden — never include:
- Any diagnosis or suspected disease name
- Any probability or likelihood of illness
- Any urgency or emergency language
- Any treatment, medication, or specialist recommendation
- Any certainty claim about the patient's health status

Return ONLY a valid JSON array. Each element: { "label": string, "explanation": string, "inRange": true | false | null }
inRange is true if value is within reference range, false if outside, null if reference range unknown.

${ALLOWED_COMMUNICATION_STYLE}`;

function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

function buildUserPrompt(entries, locale) {
  const isEn = langCode(locale) === "en";
  const lang = isEn ? "English" : "German (Deutsch)";
  const lines = entries
    .slice(0, MAX_ENTRIES)
    .map((e, i) => {
      const ref = e.referenceRangeText ? ` | Referenzbereich: ${e.referenceRangeText}` : "";
      const unit = e.unit ? ` ${e.unit}` : "";
      return `${i + 1}. ${e.label}: ${e.valueText}${unit}${ref}`;
    })
    .join("\n");

  return `Language for explanations: ${lang}\n\nLab entries:\n${lines}\n\nReturn a JSON array with one object per entry in the same order.`;
}

function parseExplanations(raw, entries) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item, i) => ({
      label: String(item?.label || entries[i]?.label || ""),
      explanation: String(item?.explanation || ""),
      inRange: item?.inRange === true ? true : item?.inRange === false ? false : null,
    }));
  } catch {
    return null;
  }
}

function fallbackExplanation(entry, locale) {
  const isEn = langCode(locale) === "en";
  return {
    label: entry.label,
    explanation: isEn
      ? "No explanation could be generated safely. Please discuss this result with your doctor."
      : "Es konnte keine sichere Erklärung erstellt werden. Bitte besprechen Sie dieses Ergebnis mit Ihrem Arzt.",
    inRange: null,
  };
}

async function callOpenAi(prompt) {
  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: attempt === 0
            ? `Return the array in a JSON object under key "explanations".\n\n${prompt}`
            : `Return the array in a JSON object under key "explanations".\n\n${prompt}\n\n${STRICT_RETRY_SUFFIX_COMPLETION}`,
        },
      ],
    });
    raw = completion.choices[0]?.message?.content || "";
    if (!shouldRegenerateUnsafeOutput(raw, AI_MODULES.LAB_PATIENT_EXPLANATION)) break;
    raw = "";
  }
  return raw;
}

function extractArrayFromResponse(raw) {
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj)) return raw;
    if (Array.isArray(obj?.explanations)) return JSON.stringify(obj.explanations);
  } catch {
    // fall through
  }
  return raw;
}

/**
 * @param {string} documentId
 * @param {string} patientUserId
 * @param {{ locale?: string, req?: import('express').Request }} ctx
 */
export async function getLabPatientExplanation(documentId, patientUserId, ctx = {}) {
  if (!isLabPatientExplanationEnabled()) throw new Error("feature_disabled");
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  const locale = String(ctx.locale || "de");
  const isEn = langCode(locale) === "en";

  const { structured } = await getPatientStructuredDocument(documentId, patientUserId, ctx);
  if (!structured) throw new Error("lab_data_not_shared");

  const entries = structured.entries || [];
  if (entries.length === 0) {
    return {
      documentId,
      explanations: [],
      disclaimer: OVERALL_DISCLAIMER[isEn ? "en" : "de"],
    };
  }

  const prompt = buildUserPrompt(entries, locale);
  const raw = await callOpenAi(prompt);
  const arrayRaw = extractArrayFromResponse(raw);

  let explanations = parseExplanations(arrayRaw, entries);
  if (!explanations) {
    explanations = entries.map((e) => fallbackExplanation(e, locale));
  }

  const safeExplanations = explanations.map((item, i) => {
    const safe = sanitizeAiOutput(item.explanation, {
      locale,
      module: AI_MODULES.LAB_PATIENT_EXPLANATION,
    });
    if (safe.usedFallback || shouldRegenerateUnsafeOutput(item.explanation, AI_MODULES.LAB_PATIENT_EXPLANATION)) {
      return fallbackExplanation(entries[i] || { label: item.label }, locale);
    }
    return { ...item, explanation: safe.text };
  });

  await writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "lab_patient_explanation.generated",
    entityType: "practice_document",
    entityId: documentId,
    metadata: { entryCount: entries.length, locale },
  });

  return {
    documentId,
    explanations: safeExplanations,
    disclaimer: OVERALL_DISCLAIMER[isEn ? "en" : "de"],
  };
}
