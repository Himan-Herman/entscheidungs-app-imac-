/**
 * Outbound email delivery abstraction.
 *
 * First production version: synchronous send (same process as API).
 *
 * TODO: When scaling outbound volume, add Redis + BullMQ (or a managed queue):
 * - PDF email to doctor contacts
 * - Follow-up / notification emails
 * - Backoff, dead-letter, and worker processes separate from the web dyno
 *
 * Env: EMAIL_QUEUE_MODE=direct (default) — no queue backend required.
 * Future: EMAIL_QUEUE_MODE=redis — enqueue only; workers consume (not implemented).
 */

import { sendEmailWithPdfAttachment, sendMail } from "../emailService.js";
import { appointmentEventEmail, practicePatientCancelledEmail } from "./calendar/appointmentEventCopy.js";

const QUEUE_MODE = (process.env.EMAIL_QUEUE_MODE || "direct").toLowerCase();

/**
 * Pre-Visit PDF to doctor contact — uses Resend with retry inside emailService.
 * Replace body with queue publish when workers exist.
 */
export async function deliverPrevisitPdfEmail(args) {
  if (QUEUE_MODE !== "direct" && QUEUE_MODE !== "") {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "email_queue_mode_unimplemented_using_direct",
        mode: QUEUE_MODE,
      }),
    );
  }
  return sendEmailWithPdfAttachment(args);
}

/**
 * Transactional appointment event email to patient (no clinical content).
 * Skips gracefully when feature flag or Resend is not configured.
 *
 * @param {{ to: string, emailEvent: string, locale: string, practiceName: string,
 *           formattedDate?: string|null, cancellationReason?: string|null,
 *           practiceContact?: {phone?:string|null,email?:string|null,address?:string|null}|null }} args
 */
export async function deliverAppointmentEventEmail({ to, emailEvent, locale, practiceName, formattedDate, cancellationReason, practiceContact }) {
  if (process.env.ENABLE_APPOINTMENT_EVENT_EMAILS !== "true") {
    return { ok: true, skipped: true, reason: "appointment_event_emails_disabled" };
  }
  if (!to) return { ok: true, skipped: true, reason: "no_recipient" };

  const email = appointmentEventEmail(emailEvent, locale, {
    practiceName,
    formattedDate: formattedDate || null,
    cancellationReason: cancellationReason || null,
    practiceContact: practiceContact || null,
  });
  if (!email) return { ok: true, skipped: true, reason: "no_template_for_event" };

  try {
    await sendMail(to, email.subject, email.text, email.html);
    return { ok: true, locale };
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.includes("RESEND") || msg.includes("nicht initialisiert")) {
      return { ok: true, skipped: true, reason: "resend_not_configured" };
    }
    throw err;
  }
}

/**
 * Practice-facing notification when a patient cancels their appointment.
 * Always in German. Skips when feature flag or Resend is not configured.
 *
 * @param {{ to: string, practiceName: string, formattedDate?: string|null, cancellationReason?: string|null }} args
 */
export async function deliverPracticePatientCancelledEmail({ to, practiceName, formattedDate, cancellationReason }) {
  if (process.env.ENABLE_APPOINTMENT_EVENT_EMAILS !== "true") {
    return { ok: true, skipped: true, reason: "appointment_event_emails_disabled" };
  }
  if (!to) return { ok: true, skipped: true, reason: "no_recipient" };

  const email = practicePatientCancelledEmail(
    practiceName,
    formattedDate || null,
    cancellationReason || null,
  );

  try {
    await sendMail(to, email.subject, email.text, email.html);
    return { ok: true };
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.includes("RESEND") || msg.includes("nicht initialisiert")) {
      return { ok: true, skipped: true, reason: "resend_not_configured" };
    }
    throw err;
  }
}

/**
 * Organizational appointment reminder email (no clinical content).
 * Skips gracefully when Resend is not configured.
 */
export async function deliverOrganizationalReminderEmail({ to, subject, text, locale }) {
  if (process.env.ENABLE_APPOINTMENT_EMAIL_REMINDERS !== "true") {
    return { ok: true, skipped: true, reason: "email_reminders_disabled" };
  }
  if (!to || !subject) {
    return { ok: false, reason: "invalid_email_payload" };
  }
  try {
    await sendMail(to, subject, text);
    return { ok: true, locale: locale || "de" };
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.includes("RESEND") || msg.includes("nicht initialisiert")) {
      return { ok: true, skipped: true, reason: "resend_not_configured" };
    }
    throw err;
  }
}
