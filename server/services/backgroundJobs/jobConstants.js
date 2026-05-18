/** Shared background job worker constants (export + OCR). */

export const JOB_STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
});

export const EXPORT_POLL_STATUSES = Object.freeze([
  JOB_STATUS.PENDING,
  JOB_STATUS.PROCESSING,
]);

export const OCR_POLL_STATUSES = Object.freeze([
  JOB_STATUS.PENDING,
  JOB_STATUS.PROCESSING,
  "running",
]);

export const JOB_RETRY_DELAYS_MS = Object.freeze([
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
]);

export const DEFAULT_MAX_JOB_ATTEMPTS = 5;
export const STALE_JOB_PROCESSING_MS = 10 * 60 * 1000;
export const OCR_JOB_TIMEOUT_MS = 12 * 60 * 1000;

export function jobWorkerBatchSize() {
  const n = Number(process.env.BACKGROUND_JOB_BATCH_SIZE);
  return Number.isFinite(n) && n > 0 ? Math.min(50, Math.floor(n)) : 15;
}

/**
 * @param {number} attemptCount — completed attempts (0-based before next retry)
 */
export function computeJobNextRetryAt(attemptCount) {
  const idx = Math.min(JOB_RETRY_DELAYS_MS.length - 1, Math.max(0, attemptCount));
  const delay = JOB_RETRY_DELAYS_MS[idx];
  const jitter = Math.floor(Math.random() * 3000);
  return new Date(Date.now() + delay + jitter);
}

/**
 * @param {string} message
 */
export function isTransientJobError(message) {
  const m = String(message || "").toLowerCase();
  if (!m) return true;
  const terminal = [
    "forbidden",
    "validation_",
    "link_not_found",
    "export_not_found",
    "feature_disabled",
    "consent",
    "ocr_disabled",
    "lab_interpretation",
    "invalid_",
  ];
  return !terminal.some((t) => m.includes(t));
}
