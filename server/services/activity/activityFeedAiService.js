import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { logSecurityEvent } from "../security/securityEventService.js";
import { listPatientActivity, listPracticeLinkActivity } from "./activityFeedService.js";

/**
 * @param {string} locale
 */
function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

const ACTIVITY_AI_SYSTEM = `You summarize ORGANIZATIONAL activity timelines for healthcare app users.

Allowed:
- Group events by category (messages, documents, medications, profile, data requests)
- Plain-language chronological overview
- Note missing information as "not provided" / "nicht angegeben"

Forbidden:
- Medical assessment, risk scoring, or diagnosis
- Therapy recommendations
- User behavior profiling
- Inventing events not in the source list
- Legal/DSGVO interpretation as legal advice

${ALLOWED_COMMUNICATION_STYLE}`;

/**
 * @param {string} prompt
 * @param {string} locale
 */
async function runAi(prompt, locale) {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.3,
      messages: [
        { role: "system", content: ACTIVITY_AI_SYSTEM },
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
      ? "Activity summary could not be generated safely. Please review the timeline manually."
      : "Aktivitätsübersicht konnte nicht sicher erstellt werden. Bitte prüfen Sie die Timeline manuell.";
  }

  const safe = sanitizeAiOutput(raw, { locale: langCode(locale) });
  return safe.text;
}

/**
 * @param {Array<{ type: string, occurredAt: Date | string, actorRole?: string }>} events
 * @param {string} locale
 */
function eventsContext(events, locale) {
  const isEn = langCode(locale) === "en";
  if (!events.length) {
    return isEn ? "No events." : "Keine Ereignisse.";
  }
  return events
    .slice(0, 40)
    .map(
      (e) =>
        `${new Date(e.occurredAt).toISOString().slice(0, 16)} | ${e.type} | ${e.actorRole || "system"}`,
    )
    .join("\n");
}

/**
 * @param {{ linkId: string, practiceProfileId: string, viewerUserId: string, locale?: string }} input
 */
export async function generatePracticeLinkActivityAiSummary(input) {
  const { events } = await listPracticeLinkActivity(
    input.linkId,
    input.practiceProfileId,
    {},
  );
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const context = eventsContext(events, locale);

  const prompt = isEn
    ? `Create a short organizational activity summary for practice staff from these metadata events only:\n\n${context}`
    : `Erstellen Sie eine kurze organisatorische Aktivitätsübersicht für Praxispersonal nur aus diesen Metadaten-Ereignissen:\n\n${context}`;

  const summary = await runAi(prompt, locale);

  await writeAuditLog({
    userId: input.viewerUserId,
    actorRole: "practice",
    action: "activity_feed_ai_summary_created",
    entityType: "practice_patient_link",
    entityId: input.linkId,
    practiceProfileId: input.practiceProfileId,
    practicePatientLinkId: input.linkId,
    visibility: "internal",
  });

  return { summary, locale: langCode(locale) };
}

/**
 * @param {{ patientUserId: string, locale?: string, linkId?: string }} input
 */
export async function generatePatientActivityAiSummary(input) {
  const { events } = await listPatientActivity(input.patientUserId, {
    linkId: input.linkId,
  });
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const context = eventsContext(events, locale);

  const prompt = isEn
    ? `Explain this patient-visible activity timeline in simple language. No medical advice:\n\n${context}`
    : `Erklären Sie diese für Patient:innen sichtbare Aktivitäts-Timeline in einfacher Sprache. Keine medizinische Beratung:\n\n${context}`;

  const summary = await runAi(prompt, locale);

  await writeAuditLog({
    userId: input.patientUserId,
    actorRole: "patient",
    action: "activity_feed_ai_summary_created",
    entityType: "patient_activity",
    entityId: input.patientUserId,
    patientUserId: input.patientUserId,
    practicePatientLinkId: input.linkId || null,
    visibility: "internal",
  });

  return { summary, locale: langCode(locale) };
}

/**
 * Log security-related access denial (metadata only).
 * @param {{ req?: import('express').Request, userId?: string, actorRole?: string, action?: string, practiceProfileId?: string, patientUserId?: string, practicePatientLinkId?: string, metadata?: Record<string, unknown> }} opts
 */
export function logAccessDenied(opts) {
  logSecurityEvent({
    req: opts.req,
    userId: opts.userId ?? null,
    actorRole: opts.actorRole ?? null,
    eventType: opts.action || "forbidden_api_access",
    practiceProfileId: opts.practiceProfileId ?? null,
    patientUserId: opts.patientUserId ?? null,
    practicePatientLinkId: opts.practicePatientLinkId ?? null,
    entityId: opts.practicePatientLinkId || opts.practiceProfileId || "global",
    metadata: opts.metadata ?? null,
  });
}
