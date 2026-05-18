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
