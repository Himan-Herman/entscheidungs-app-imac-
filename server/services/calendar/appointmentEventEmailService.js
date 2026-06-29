/**
 * Appointment event transactional email orchestrator.
 *
 * Fetches patient email + practice name, resolves locale, calls delivery.
 * Never throws — always returns { ok, skipped?, reason? }.
 * Mail failure never affects appointment status.
 */

import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";
import {
  deliverAppointmentEventEmail,
  deliverPracticePatientCancelledEmail,
} from "../emailQueueService.js";
import { resolveEmailLocale } from "./appointmentService.js";


/**
 * Events that trigger a patient email.
 * Callers now pass explicit event strings — no runtime disambiguation needed.
 */
const EMAILABLE_EVENTS = new Set([
  "request",
  "confirmed",
  "declined",
  "cancelledByPatient",
  "cancelledByPractice",
]);

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
 * Send an organisational event email.
 * Called fire-and-forget from appointmentNotify — errors are logged, never re-thrown.
 *
 * For cancelledByPatient: also sends a practice-facing notification if practice.email is set.
 * For cancelledByPractice: includes organisational cancellation note and practice contact details.
 *
 * @param {object} appt  PracticeAppointment row
 * @param {'request'|'confirmed'|'declined'|'cancelledByPatient'|'cancelledByPractice'} event
 */
export async function sendAppointmentEventEmail(appt, event) {
  if (!EMAILABLE_EVENTS.has(event)) {
    return { ok: true, skipped: true, reason: "event_not_emailable" };
  }
  const patientUserId = appt.patientUserId;
  if (!patientUserId) {
    return { ok: true, skipped: true, reason: "no_patient" };
  }

  try {
    const [user, practice] = await Promise.all([
      prisma.user.findUnique({
        where: { id: patientUserId },
        select: { email: true, profile: { select: { preferredPatientLanguage: true } } },
      }),
      prisma.practiceProfile.findUnique({
        where: { id: appt.practiceProfileId },
        select: {
          practiceName: true,
          phone: true,
          email: true,
          address: true,
          street: true,
          city: true,
          postalCode: true,
        },
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

    // Organisational cancellation note — only for cancel events, max 200 chars, no medical evaluation.
    const cancellationReason =
      (event === "cancelledByPractice" || event === "cancelledByPatient") &&
      appt.cancellationReason
        ? String(appt.cancellationReason).slice(0, 200)
        : null;

    // Practice contact block — only for cancelledByPractice patient email.
    let practiceContact = null;
    if (event === "cancelledByPractice" && practice) {
      const addressParts = [practice.street, practice.city, practice.postalCode].filter(Boolean);
      const combinedAddress = practice.address || (addressParts.length ? addressParts.join(", ") : null);
      practiceContact = {
        phone: practice.phone || null,
        email: practice.email || null,
        address: combinedAddress || null,
      };
    }

    const result = await deliverAppointmentEventEmail({
      to: user.email,
      emailEvent: event,
      locale,
      practiceName,
      formattedDate,
      cancellationReason,
      practiceContact,
    });

    writeAuditLog({
      actorRole: "system",
      action: "appointment_event_email_sent",
      entityType: "PracticeAppointment",
      entityId: appt.id,
      metadata: {
        emailEvent: event,
        locale,
        skipped: result.skipped ?? false,
        reason: result.reason ?? null,
      },
    }).catch(() => {});

    // Practice notification when patient cancels — fire-and-forget.
    if (event === "cancelledByPatient" && practice?.email) {
      const practiceFormattedDate = appt.startAt ? formatDateForLocale(appt.startAt, "de") : null;
      deliverPracticePatientCancelledEmail({
        to: practice.email,
        practiceName,
        formattedDate: practiceFormattedDate,
        cancellationReason,
      })
        .then((r) => {
          writeAuditLog({
            actorRole: "system",
            action: "appointment_event_email_sent",
            entityType: "PracticeAppointment",
            entityId: appt.id,
            metadata: {
              emailEvent: "cancelledByPatient_practice_notify",
              locale: "de",
              skipped: r.skipped ?? false,
              reason: r.reason ?? null,
            },
          }).catch(() => {});
        })
        .catch(() => {});
    }

    return result;
  } catch (err) {
    const reason = String(err?.message || "unknown").slice(0, 120);
    writeAuditLog({
      actorRole: "system",
      action: "appointment_event_email_failed",
      entityType: "PracticeAppointment",
      entityId: appt.id,
      metadata: { emailEvent: event, reason },
    }).catch(() => {});
    console.error(
      JSON.stringify({
        level: "error",
        event: "appointment_event_email_failed",
        apptId: appt.id,
        emailEvent: event,
        reason,
      }),
    );
    return { ok: false, error: reason };
  }
}
