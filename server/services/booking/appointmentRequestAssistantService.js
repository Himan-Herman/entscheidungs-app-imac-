/**
 * Appointment Request AI Assistant — organisational layer only.
 *
 * Supported actions:
 *   "summarize"   — short organisational summary of the booking request for practice staff
 *   "reply_draft" — neutral reply template in the patient's locale
 *
 * Data sent to OpenAI: appointment type, preferred time, location type,
 *   patientNote (max 500 chars), practice name, communicationLocale.
 *
 * Never sent: anamnesis, health profile, diagnoses, documents, patientUser PII
 *   (email/name), practiceNote, cancellationReason, medication data.
 *
 * Output is never persisted. Safety-checked via AI_MODULES.APPOINTMENT_ASSISTANT
 * before returning. If output is unsafe or OpenAI unavailable, a safe fallback is
 * returned and the appointment workflow is unaffected.
 */

import { prisma } from "../../lib/prisma.js";
import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from "../../config/openAiModels.js";
import {
  AI_MODULES,
  APPOINTMENT_ASSISTANT_SYSTEM_PROMPT_SAFETY,
  getSafeFallback,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";


/** Maximum characters of patientNote sent to AI. */
const MAX_PATIENT_NOTE_CHARS = 500;

/** Token budgets per action (intentionally tight to limit cost and scope). */
const MAX_TOKENS = {
  summarize: 200,
  reply_draft: 220,
};

const SUPPORTED_ACTIONS = new Set(["summarize", "reply_draft"]);

/** Human-readable location labels for the prompt (no medical interpretation). */
const LOCATION_LABEL = {
  practice: "in-person at the practice",
  video: "video consultation",
  phone: "phone consultation",
  external: "external location",
  unknown: "not specified",
};

/**
 * Format a DateTime for inclusion in the prompt (ISO date + time, UTC).
 * @param {Date|string|null|undefined} dt
 * @returns {string}
 */
function fmtDate(dt) {
  if (!dt) return "not specified";
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return "not specified";
    return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  } catch {
    return "not specified";
  }
}

/**
 * Load only the organisationally relevant, AI-safe fields for one appointment.
 * Explicitly excludes: patientUser PII, practiceNote, cancellationReason,
 * preVisitSession, anamnesis link, telemedicineSession, reminders.
 *
 * @param {string} appointmentId
 * @param {string} practiceId   - enforces cross-practice access prevention
 * @returns {Promise<object|null>}
 */
async function loadSafeAppointmentContext(appointmentId, practiceId) {
  const row = await prisma.practiceAppointment.findFirst({
    where: {
      id: appointmentId,
      practiceProfileId: practiceId,   // must belong to this practice
      status: "requested",              // assistant only relevant for open requests
    },
    select: {
      id: true,
      practiceProfileId: true,
      patientNote: true,
      communicationLocale: true,
      locationType: true,
      requestedStartAt: true,
      requestedEndAt: true,
      startAt: true,
      endAt: true,
      appointmentType: {
        select: { name: true, durationMinutes: true },
      },
      practiceProfile: {
        select: { practiceName: true, displayNameForPatients: true },
      },
      // NOT selected: patientUserId, patientUser, practicePatientLinkId,
      // practiceNote, cancellationReason, preVisitSessionId, requestConsentScope,
      // requestConsentVersion, createdByUserId, cancelledByUserId, cancelledAt,
      // telemedicineSession, reminders
    },
  });
  return row;
}

/**
 * Build the organisational context block sent to OpenAI.
 * Trims patientNote, maps enums, never forwards forbidden fields.
 *
 * @param {object} row
 * @returns {string}
 */
function buildContextBlock(row) {
  const practiceName =
    row.practiceProfile?.displayNameForPatients ||
    row.practiceProfile?.practiceName ||
    "the practice";

  const appointmentTypeName = row.appointmentType?.name || "not specified";

  const location = LOCATION_LABEL[row.locationType] || "not specified";

  const requestedTime = row.requestedStartAt
    ? fmtDate(row.requestedStartAt)
    : row.startAt
    ? fmtDate(row.startAt)
    : "not specified";

  const locale = row.communicationLocale || "de";

  const rawNote = typeof row.patientNote === "string" ? row.patientNote : "";
  const note = rawNote.trim().slice(0, MAX_PATIENT_NOTE_CHARS) || "none";

  return [
    `Practice: ${practiceName}`,
    `Appointment type: ${appointmentTypeName}`,
    `Location: ${location}`,
    `Requested time: ${requestedTime}`,
    `Patient locale: ${locale}`,
    `Patient note (organisational free text, max 500 chars): ${note}`,
  ].join("\n");
}

/**
 * Build the system prompt for the given action.
 *
 * @param {"summarize"|"reply_draft"} action
 * @param {string} locale   BCP-47 patient locale (for reply_draft)
 * @returns {string}
 */
function buildSystemPrompt(action, locale) {
  const base =
    action === "summarize"
      ? `You are an organisational scheduling assistant for a medical practice (MedScoutX). ` +
        `Summarise the appointment request in 2–4 short sentences for the practice team, in German. ` +
        `Cover only: appointment type, preferred time/date, location, ` +
        `and briefly note any obviously missing organisational fields (time, type, location). ` +
        `Do not translate, interpret, or reproduce any medical content from the patient note. ` +
        `If the patient note contains medical symptoms or diagnoses, omit it entirely and describe only the scheduling intent.`
      : `You are an organisational scheduling assistant for a medical practice (MedScoutX). ` +
        `Write a short, neutral reply draft (2–4 sentences) from the practice to the patient, in the patient's language (locale: ${locale}). ` +
        `The reply should be a polite scheduling acknowledgement or soft confirmation — purely organisational. ` +
        `Do not provide medical advice, mention symptoms, reference the patient note content, or comment on urgency.`;

  return `${base}\n\n${APPOINTMENT_ASSISTANT_SYSTEM_PROMPT_SAFETY}`;
}

/**
 * Run the appointment request AI assistant.
 *
 * @param {{
 *   appointmentId: string,
 *   practiceId:    string,
 *   actorUserId:   string,
 *   actorRole:     string,
 *   action:        "summarize"|"reply_draft",
 * }} params
 * @returns {Promise<{ result: string, used_fallback: boolean, action: string }>}
 */
export async function runAppointmentAssistant({
  appointmentId,
  practiceId,
  actorUserId,
  actorRole,
  action,
}) {
  // --- Input validation ---
  if (!SUPPORTED_ACTIONS.has(action)) {
    throw Object.assign(new Error("unsupported_action"), { status: 400 });
  }
  if (!appointmentId || !practiceId || !actorUserId) {
    throw Object.assign(new Error("missing_required_params"), { status: 400 });
  }

  // --- Load safe context (no forbidden fields) ---
  const row = await loadSafeAppointmentContext(appointmentId, practiceId);
  if (!row) {
    throw Object.assign(new Error("appointment_not_found"), { status: 404 });
  }

  const locale = row.communicationLocale || "de";
  const fallback = getSafeFallback(AI_MODULES.APPOINTMENT_ASSISTANT, locale);

  // --- Guard: OpenAI must be configured ---
  if (!process.env.OPENAI_API_KEY) {
    writeAuditLog({
      userId: actorUserId,
      actorRole,
      action: "ai_appointment_assist",
      entityType: "appointment",
      entityId: appointmentId,
      practiceProfileId: practiceId,
      metadata: { module: "appointment_assistant", action, locale, skipped: "no_api_key" },
    });
    return { result: fallback, used_fallback: true, action };
  }

  // --- Build prompts (no forbidden data) ---
  const systemPrompt = buildSystemPrompt(action, locale);
  const contextBlock = buildContextBlock(row);

  let rawOutput = "";

  try {
    const response = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextBlock },
      ],
      max_tokens: MAX_TOKENS[action],
      temperature: 0.2,
    });

    rawOutput = response?.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    // Log failure without any content — appointment flow unaffected
    console.error(
      JSON.stringify({
        level: "error",
        event: "ai_appointment_assist_openai_error",
        action,
        reason: String(err?.message || "unknown").slice(0, 100),
      }),
    );
    writeAuditLog({
      userId: actorUserId,
      actorRole,
      action: "ai_appointment_assist",
      entityType: "appointment",
      entityId: appointmentId,
      practiceProfileId: practiceId,
      metadata: { module: "appointment_assistant", action, locale, error: "openai_call_failed" },
    });
    return { result: fallback, used_fallback: true, action };
  }

  // --- Safety check on AI output (never bypass) ---
  const sanitized = sanitizeAiOutput(rawOutput, {
    module: AI_MODULES.APPOINTMENT_ASSISTANT,
    locale,
  });

  // --- Audit: metadata only, no content, no medical data ---
  writeAuditLog({
    userId: actorUserId,
    actorRole,
    action: "ai_appointment_assist",
    entityType: "appointment",
    entityId: appointmentId,
    practiceProfileId: practiceId,
    metadata: {
      module: "appointment_assistant",
      action,
      locale,
      used_fallback: sanitized.used_fallback,
    },
  });

  return {
    result: sanitized.text,
    used_fallback: sanitized.used_fallback,
    action,
  };
}
