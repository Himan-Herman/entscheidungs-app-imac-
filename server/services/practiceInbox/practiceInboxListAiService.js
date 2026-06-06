import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { listPracticeInboxItems } from "./practiceInboxService.js";

const PRACTICE_INBOX_AI_SYSTEM = `You summarize a practice team's organizational inbox only.

Allowed:
- Group by notification type
- Neutral task overview for staff
- Mark missing fields as not provided

Forbidden:
- Medical triage, urgency, diagnosis, therapy
- Patient scoring or surveillance
- Message bodies or clinical details

${ALLOWED_COMMUNICATION_STYLE}`;

function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

async function runAi(prompt, locale) {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.25,
      messages: [
        { role: "system", content: PRACTICE_INBOX_AI_SYSTEM },
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
      ? "Summary could not be generated safely. Please review the inbox manually."
      : "Zusammenfassung konnte nicht sicher erstellt werden. Bitte prüfen Sie das Postfach manuell.";
  }

  return sanitizeAiOutput(raw, { locale: langCode(locale) }).text;
}

/**
 * @param {string} practiceProfileId
 * @param {{ locale?: string, userId?: string, actorRole?: string }} input
 * @param {{ req?: import('express').Request }} ctx
 */
export async function generatePracticeInboxListAiSummary(practiceProfileId, input, ctx = {}) {
  const result = await listPracticeInboxItems(practiceProfileId, { limit: 50 });
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";

  const meta = result.items.map((i) => ({
    type: i.type,
    status: i.status,
    priority: i.priority,
    lastActivityAt: i.lastActivityAt,
    hasPatient: Boolean(i.patientUserId),
  }));

  const prompt = [
    isEn ? "Language: English" : "Sprache: Deutsch",
    `Practice inbox items (metadata only): ${JSON.stringify(meta)}`,
    isEn
      ? "Short organizational overview for the practice team."
      : "Kurze organisatorische Übersicht für das Praxisteam.",
  ].join("\n");

  const summary = await runAi(prompt, locale);

  writeAuditLog({
    req: ctx.req,
    userId: input.userId,
    actorRole: input.actorRole,
    action: "practice_inbox_ai_summary_created",
    entityType: "inbox_item",
    entityId: practiceProfileId,
    practiceProfileId,
    metadata: { itemCount: result.items.length, scope: "list" },
  });

  return {
    summary,
    aiSuggestionLabel: isEn ? "AI summary – please review" : "Automatische Zusammenfassung – bitte prüfen",
    aiDisclaimer: isEn
      ? "AI only summarizes organizational inbox information and does not provide medical assessment."
      : "Fasst nur organisatorische Postfachinformationen zusammen und gibt keine medizinische Bewertung.",
  };
}
