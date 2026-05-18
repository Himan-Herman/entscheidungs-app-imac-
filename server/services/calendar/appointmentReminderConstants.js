/** Reminder lifecycle statuses */
export const REMINDER_STATUSES = new Set([
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
]);

/** Delivery channel */
export const REMINDER_TYPES = new Set(["inbox", "system", "email"]);

/** Logical keys — unique per appointment */
export const REMINDER_KEYS = Object.freeze({
  PATIENT_24H_INBOX: "patient_24h_inbox",
  PATIENT_1H_INBOX: "patient_1h_inbox",
  PRACTICE_24H_SYSTEM: "practice_24h_system",
});

export const MS_24H = 24 * 60 * 60 * 1000;
export const MS_1H = 60 * 60 * 1000;

/** Worker batch size per cron tick */
export const REMINDER_BATCH_SIZE = 50;

/** Stuck processing recovery threshold */
export const REMINDER_PROCESSING_STALE_MS = 10 * 60 * 1000;

/** Default max delivery attempts (claim increments attemptCount) */
export const REMINDER_DEFAULT_MAX_RETRIES = 3;

/** Exponential backoff base (ms): 5m, 15m, 45m … */
export const REMINDER_RETRY_BASE_MS = 5 * 60 * 1000;
export const REMINDER_RETRY_CAP_MS = 3 * 60 * 60 * 1000;

export const APPOINTMENT_ACTIVE_FOR_REMINDERS = new Set([
  "scheduled",
  "confirmed",
  "rescheduled",
]);
