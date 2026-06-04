/**
 * Appointment event transactional email orchestrator.
 *
 * Fetches patient email + practice name, resolves locale, calls delivery.
 * Never throws — always returns { ok, skipped?, reason? }.
 * Mail failure never affects appointment status.
 */

import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import { deliverAppointmentEventEmail } from "../emailQueueService.js";
import { resolveEmailLocale } from "./appointmentService.js";

const prisma = new PrismaClient();

const EMAILABLE_EVENTS = new Set(["request", "confirmed", "cancelled"]);

/** BCP-47 locale tags for Intl.DateTimeFormat — covers the 5 email locales. */
const INTL_LOCALE = { de: "de-DE", en: "en-GB", fr: "fr-FR", it: "it-IT", es: "es-ES" };

function formatDateForLocale(date, locale) {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale] || "de-DE", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(date));
  } catch {
    return null;
  }
}

/**
 * Map the generic notify event + appointment data to a specific email event type.
 *
 * "cancelled" is sent both when the practice declines a request and when the patient
 * cancels their own appointment. Distinguish via cancelledByUserId.
 */
function resolveEmailEvent(appt, event) {
  if (event === "cancelled") {
    return appt.cancelledByUserId === appt.patientUserId ? "cancelledByPatient" : "declined";
  }
  return event; // "request" | "confirmed"
}

/**
 * Send an organisational event email to the patient.
 * Called fire-and-forget from appointmentNotify — errors are logged, never re-thrown.
 *
 * @param {object} appt  PracticeAppointment row (must include id, patientUserId, practiceProfileId,
 *                        communicationLocale, cancelledByUserId, startAt)
 * @param {'request'|'confirmed'|'cancelled'} event
 */
export async function sendAppointmentEventEmail(appt, event) {
  if (!EMAILABLE_EVENTS.has(event)) {
    return { ok: true, skipped: true, reason: "event_not_emailable" };
  }
  const patientUserId = appt.patientUserId;
  if (!patientUserId) {
    return { ok: true, skipped: true, reason: "no_patient" };
  }

  const emailEvent = resolveEmailEvent(appt, event);

  try {
    const [user, practice] = await Promise.all([
      prisma.user.findUnique({
        where: { id: patientUserId },
        select: { email: true, profile: { select: { preferredPatientLanguage: true } } },
      }),
      prisma.practiceProfile.findUnique({
        where: { id: appt.practiceProfileId },
        select: { practiceName: true },
      }),
    ]);

    if (!user?.email) {
      return { ok: true, skipped: true, reason: "no_email_on_file" };
    }

    // Locale priority: stored communicationLocale → user profile language → "de"
    const rawLocale =
      appt.communicationLocale ||
      user.profile?.preferredPatientLanguage ||
      "de";
    const locale = resolveEmailLocale(rawLocale);

    const practiceName = practice?.practiceName || "MedScoutX";
    const formattedDate = appt.startAt ? formatDateForLocale(appt.startAt, locale) : null;

    const result = await deliverAppointmentEventEmail({
      to: user.email,
      emailEvent,
      locale,
      practiceName,
      formattedDate,
    });

    writeAuditLog({
      actorRole: "system",
      action: "appointment_event_email_sent",
      entityType: "PracticeAppointment",
      entityId: appt.id,
      metadata: {
        emailEvent,
        locale,
        skipped: result.skipped ?? false,
        reason: result.reason ?? null,
      },
    }).catch(() => {});

    return result;
  } catch (err) {
    const reason = String(err?.message || "unknown").slice(0, 120);
    writeAuditLog({
      actorRole: "system",
      action: "appointment_event_email_failed",
      entityType: "PracticeAppointment",
      entityId: appt.id,
      metadata: { emailEvent, reason },
    }).catch(() => {});
    console.error(
      JSON.stringify({
        level: "error",
        event: "appointment_event_email_failed",
        apptId: appt.id,
        emailEvent,
        reason,
      }),
    );
    return { ok: false, error: reason };
  }
}
