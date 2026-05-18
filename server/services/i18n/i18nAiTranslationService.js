import { writeAuditLog } from "../auditLogService.js";

const DISCLAIMER_DE =
  "Die KI unterstützt nur bei organisatorischen UI-Texten — keine medizinische Neuinterpretation.";
const DISCLAIMER_EN =
  "AI only supports organizational UI text — no medical reinterpretation.";
const AUTO_NOTICE_DE =
  "Automatisch übersetzte organisatorische Information – bitte prüfen.";
const AUTO_NOTICE_EN =
  "Automatically translated organizational information – please review.";
const AI_LABEL_DE = "KI-unterstützte organisatorische Übersetzung – bitte prüfen";
const AI_LABEL_EN = "AI-assisted organizational translation – please review";

const BLOCKED_PATTERNS =
  /diagnos|therap|medikament|labor|befund|dosierung|krankheit|tumor|infarkt/i;

/**
 * Rule-based organizational text helper — no medical reinterpretation, no external APIs.
 * @param {{ text: string, sourceLocale?: string, targetLocale?: string, userId?: string, req?: import('express').Request }} input
 */
export async function translateOrganizationalText(input) {
  const text = String(input.text || "").trim().slice(0, 2000);
  if (!text) throw new Error("validation_required");

  if (BLOCKED_PATTERNS.test(text)) {
    throw new Error("validation_medical_content_not_allowed");
  }

  const de = !String(input.targetLocale || "de").toLowerCase().startsWith("en");

  await writeAuditLog({
    req: input.req,
    userId: input.userId ?? null,
    actorRole: "user",
    action: "i18n_ai_translation_created",
    entityType: "i18n",
    entityId: "organizational",
    metadata: {
      sourceLocale: input.sourceLocale || null,
      targetLocale: de ? "de" : "en",
      charCount: text.length,
    },
  });

  return {
    label: de ? AI_LABEL_DE : AI_LABEL_EN,
    disclaimer: de ? DISCLAIMER_DE : DISCLAIMER_EN,
    notice: de ? AUTO_NOTICE_DE : AUTO_NOTICE_EN,
    text,
    aiGenerated: true,
    unchanged: true,
  };
}
