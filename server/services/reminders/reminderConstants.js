/** Appointment / follow-up reminder worker constants. */

export const REMINDER_STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  SENT: "sent",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

export const REMINDER_CHANNEL = Object.freeze({
  INBOX: "inbox",
  SYSTEM: "system",
  EMAIL: "email",
});

export const SUBJECT_KIND = Object.freeze({
  APPOINTMENT: "appointment",
  FOLLOW_UP: "follow_up",
});

export const DEFAULT_MAX_ATTEMPTS = 5;
export const STALE_PROCESSING_MS = 10 * 60 * 1000;
export const MS_24H = 24 * 60 * 60 * 1000;
export const MS_1H = 60 * 60 * 1000;
export const MS_15M = 15 * 60 * 1000;
export const MS_48H = 48 * 60 * 60 * 1000;

export const RETRY_BASE_MS = 60 * 1000;
export const RETRY_CAP_MS = 60 * 60 * 1000;

export function workerBatchSize() {
  const n = Number(process.env.REMINDER_WORKER_BATCH_SIZE);
  return Number.isFinite(n) && n > 0 ? Math.min(100, Math.floor(n)) : 25;
}

export function isAppointmentEmailRemindersEnabled() {
  return process.env.ENABLE_APPOINTMENT_EMAIL_REMINDERS === "true";
}

export function computeNextRetryAt(attemptCount) {
  const exp = RETRY_BASE_MS * 2 ** Math.max(0, attemptCount);
  const delay = Math.min(RETRY_CAP_MS, exp);
  const jitter = Math.floor(Math.random() * 5000);
  return new Date(Date.now() + delay + jitter);
}
