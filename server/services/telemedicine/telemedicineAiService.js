import { openai } from "../../openaiClient.js";
import { ALLOWED_COMMUNICATION_STYLE } from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageTelemedicine, canReadTelemedicine } from "../../utils/practicePermissions.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';

const TELE_AI_SYSTEM = `You help with ORGANIZATIONAL video consultation instructions only.

Allowed:
- Technical join steps in plain language
- Pre-join checklist (camera, microphone, quiet room, stable connection)
- Polite scheduling reminders
- Structure for follow-up notes when staff provides their own text

Forbidden:
- Analyzing conversation content
- Diagnosis, therapy, urgency triage
- Emotional or behavioral medical assessment
- Transcription or medical summaries

${ALLOWED_COMMUNICATION_STYLE}`;

export async function telemedicineInstructions(actorUserId, practiceId, input, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadTelemedicine(access.role)) throw new Error("forbidden");
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  const locale = String(input.locale || "de").toLowerCase().startsWith("en") ? "en" : "de";
  const completion = await openai.chat.completions.create({
    model: getOpenAiChatModel(),
    temperature: 0.2,
    messages: [
      { role: "system", content: TELE_AI_SYSTEM },
      {
        role: "user",
        content: `Language: ${locale}\nCreate a short technical pre-join checklist for a video consultation.`,
      },
    ],
  });

  const text = sanitizeAiOutput(completion.choices?.[0]?.message?.content || "").slice(0, 2000);
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "telemedicine_ai_instructions",
    practiceProfileId: practiceId,
    metadata: { chars: text.length },
  }).catch(() => {});
  return { text, aiMarked: true };
}

export async function telemedicineFollowupDraft(actorUserId, practiceId, sessionId, input, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageTelemedicine(access.role)) throw new Error("forbidden");
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  const notes = String(input.notes || "").slice(0, 1500);
  const completion = await openai.chat.completions.create({
    model: getOpenAiChatModel(),
    temperature: 0.2,
    messages: [
      { role: "system", content: TELE_AI_SYSTEM },
      {
        role: "user",
        content: `Structure this organizational follow-up note (no medical content):\n${notes}`,
      },
    ],
  });

  const text = sanitizeAiOutput(completion.choices?.[0]?.message?.content || "").slice(0, 2000);
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "telemedicine_ai_followup",
    practiceProfileId: practiceId,
    metadata: { sessionId, chars: text.length },
  }).catch(() => {});
  return { text, aiMarked: true };
}
