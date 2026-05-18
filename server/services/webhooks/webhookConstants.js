/** Webhook worker — shared statuses, retry schedule, limits. */

export const WEBHOOK_DELIVERY_STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  DELIVERED: "delivered",
  RETRYING: "retrying",
  FAILED: "failed",
  DEAD_LETTER: "dead_letter",
  CANCELLED: "cancelled",
  SKIPPED: "skipped",
});

/** Legacy PracticeWebhookEvent terminal / in-flight statuses we poll. */
export const LEGACY_POLL_STATUSES = Object.freeze([
  WEBHOOK_DELIVERY_STATUS.PENDING,
  WEBHOOK_DELIVERY_STATUS.RETRYING,
]);

/** Developer PracticeWebhookDelivery statuses we poll. */
export const DEVELOPER_POLL_STATUSES = Object.freeze([
  WEBHOOK_DELIVERY_STATUS.PENDING,
  WEBHOOK_DELIVERY_STATUS.RETRYING,
]);

/** Attempt 1 → 5: 1m, 5m, 15m, 1h, 6h (then dead_letter). */
export const WEBHOOK_RETRY_DELAYS_MS = Object.freeze([
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
]);

export const DEFAULT_MAX_WEBHOOK_ATTEMPTS = 5;
export const WEBHOOK_HTTP_TIMEOUT_MS = 8000;
export const STALE_WEBHOOK_PROCESSING_MS = 10 * 60 * 1000;

export function workerBatchSize() {
  const n = Number(process.env.WEBHOOK_WORKER_BATCH_SIZE);
  return Number.isFinite(n) && n > 0 ? Math.min(100, Math.floor(n)) : 30;
}

/**
 * @param {number} attemptCount — attempts already completed (0-based before increment)
 */
export function computeWebhookNextRetryAt(attemptCount) {
  const idx = Math.min(
    WEBHOOK_RETRY_DELAYS_MS.length - 1,
    Math.max(0, attemptCount),
  );
  const delay = WEBHOOK_RETRY_DELAYS_MS[idx];
  const jitter = Math.floor(Math.random() * 3000);
  return new Date(Date.now() + delay + jitter);
}

/**
 * @param {number | null | undefined} statusCode
 * @param {string} [networkError]
 */
export function classifyWebhookHttpResult(statusCode, networkError) {
  if (networkError) {
    const retryable =
      networkError === "timeout" || networkError === "network_error";
    return { retryable, terminal: !retryable, errorCode: networkError };
  }
  if (statusCode == null) {
    return { retryable: true, terminal: false, errorCode: "unknown" };
  }
  if (statusCode >= 200 && statusCode < 300) {
    return { retryable: false, terminal: false, success: true, errorCode: null };
  }
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) {
    return { retryable: true, terminal: false, errorCode: `http_${statusCode}` };
  }
  if (statusCode >= 400 && statusCode < 500) {
    return { retryable: false, terminal: true, errorCode: `http_${statusCode}` };
  }
  return { retryable: true, terminal: false, errorCode: `http_${statusCode}` };
}
