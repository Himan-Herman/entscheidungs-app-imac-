import { openai } from "../../openaiClient.js";
import { ALLOWED_COMMUNICATION_STYLE } from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageCalendar, canReadCalendar } from "../../utils/practicePermissions.js";

const CALENDAR_AI_SYSTEM = `You assist with ORGANIZATIONAL scheduling only.

Allowed:
- Polite neutral wording for appointment notes
- Summarize calendar counts (no patient names unless provided as "Patient A")
- Suggest missing fields: time range, contact method, appointment type
- List free slots based on provided availability windows (organizational)

Strictly forbidden:
- Medical urgency or triage
- Prioritizing patients by symptoms
- Diagnosis, therapy, emergency advice
- Preferring appointments based on medical content

Use "nicht angegeben" (DE) or "not provided" (EN) for missing info.
${ALLOWED_COMMUNICATION_STYLE}`;

function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

export async function practiceScheduleSummary(actorUserId, practiceId, input, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadCalendar(access.role)) throw new Error("forbidden");
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  const locale = langCode(input.locale);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: CALENDAR_AI_SYSTEM },
      {
        role: "user",
        content: [
          `Language: ${locale === "en" ? "English" : "German"}`,
          "Summarize this organizational calendar overview:",
          JSON.stringify(input.summary || {}).slice(0, 3000),
        ].join("\n"),
      },
    ],
  });

  const text = sanitizeAiOutput(completion.choices?.[0]?.message?.content || "").slice(0, 2500);
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "appointment_ai_summary",
    practiceProfileId: practiceId,
    metadata: { chars: text.length },
  }).catch(() => {});
  return { text, aiMarked: true, locale };
}

export async function practiceReplyDraft(actorUserId, practiceId, input, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendar(access.role)) throw new Error("forbidden");
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  const locale = langCode(input.locale);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: CALENDAR_AI_SYSTEM },
      {
        role: "user",
        content: [
          `Language: ${locale === "en" ? "English" : "German"}`,
          `Context: ${String(input.context || "appointment_reply").slice(0, 200)}`,
          `Draft notes: ${String(input.notes || "").slice(0, 800)}`,
          "Draft a short neutral reply to the patient about scheduling (no medical content).",
        ].join("\n"),
      },
    ],
  });

  const text = sanitizeAiOutput(completion.choices?.[0]?.message?.content || "").slice(0, 1500);
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "appointment_ai_reply_draft",
    practiceProfileId: practiceId,
    metadata: { chars: text.length },
  }).catch(() => {});
  return { text, aiMarked: true, locale };
}

export async function patientRequestDraft(patientUserId, input, ctx = {}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");
  const locale = langCode(input.locale);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: CALENDAR_AI_SYSTEM },
      {
        role: "user",
        content: [
          `Language: ${locale === "en" ? "English" : "German"}`,
          `Organizational notes: ${String(input.notes || "").slice(0, 800)}`,
          "Structure a neutral appointment request message (no symptoms, no urgency).",
        ].join("\n"),
      },
    ],
  });

  const text = sanitizeAiOutput(completion.choices?.[0]?.message?.content || "").slice(0, 1200);
  writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "appointment_ai_request_draft",
    metadata: { chars: text.length },
  }).catch(() => {});
  return { text, aiMarked: true, locale };
}
