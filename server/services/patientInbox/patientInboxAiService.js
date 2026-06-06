import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { listInboxItemsForPatient } from "./patientInboxService.js";

const INBOX_AI_SYSTEM = `You summarize a patient's organizational practice inbox only.

Allowed:
- Group similar neutral notification types
- Short daily overview in plain language
- Note missing metadata as "not provided" / "nicht angegeben"

Forbidden:
- Medical prioritization, urgency, diagnosis, therapy
- Medication names, lab values, message bodies
- Scoring or surveillance of the patient

${ALLOWED_COMMUNICATION_STYLE}`;

function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

/**
 * @param {string} prompt
 * @param {string} locale
 */
async function runInboxAi(prompt, locale) {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.25,
      messages: [
        { role: "system", content: INBOX_AI_SYSTEM },
        {
          role: "user",
          content:
            attempt === 0 ? prompt : `${prompt}\n\n${STRICT_RETRY_SUFFIX_COMPLETION}`,
        },
      ],
    });
    raw = completion.choices[0]?.message?.content || "";
    if (!shouldRegenerateUnsafeOutput(raw)) break;
    raw = "";
  }

  if (!raw) {
    return langCode(locale) === "en"
      ? "Summary could not be generated safely. Please review your inbox manually."
      : "Zusammenfassung konnte nicht sicher erstellt werden. Bitte prüfen Sie Ihr Postfach manuell.";
  }

  return sanitizeAiOutput(raw, { locale: langCode(locale) }).text;
}

/**
 * @param {string} patientUserId
 * @param {{ locale?: string }} input
 * @param {{ req?: import('express').Request }} ctx
 */
export async function generatePatientInboxAiSummary(patientUserId, input, ctx = {}) {
  const { items } = await listInboxItemsForPatient(patientUserId, { limit: 40 });
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";

  const meta = items.map((i) => ({
    type: i.type,
    status: i.status,
    createdAt: i.createdAt,
    practice: i.practice?.practiceName || (isEn ? "not provided" : "nicht angegeben"),
  }));

  const prompt = [
    isEn ? "Language: English" : "Sprache: Deutsch",
    `Inbox items (metadata only): ${JSON.stringify(meta)}`,
    isEn
      ? "Provide a short organizational inbox summary. No medical assessment."
      : "Kurze organisatorische Postfach-Zusammenfassung. Keine medizinische Bewertung.",
  ].join("\n");

  const summary = await runInboxAi(prompt, locale);

  writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "patient_inbox_ai_summary_created",
    entityType: "inbox_item",
    entityId: patientUserId,
    patientUserId,
    metadata: { itemCount: items.length },
  });

  return {
    summary,
    aiSuggestionLabel: isEn ? "AI summary – please review" : "Automatische Zusammenfassung – bitte prüfen",
    aiDisclaimer: isEn
      ? "AI only summarizes organizational inbox information and does not provide medical assessment."
      : "Fasst nur organisatorische Postfachinformationen zusammen und gibt keine medizinische Bewertung.",
  };
}
