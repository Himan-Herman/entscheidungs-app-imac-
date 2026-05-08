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

import { sendEmailWithPdfAttachment } from "../emailService.js";

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
