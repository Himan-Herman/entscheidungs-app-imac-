/** Errors that are expected during cancel/speaker-switch and must not collapse the session. */
const IGNORABLE_ERROR_CODES = new Set([
  "response_cancel_not_active",
  "cancellation_failed",
  "conversation_already_has_active_response",
]);

/** Session is no longer usable — user must reconnect. */
const FATAL_ERROR_CODES = new Set([
  "session_expired",
  "invalid_session",
  "authentication_failed",
  "insufficient_quota",
]);

/**
 * @param {unknown} event
 * @returns {{ ignorable: boolean; fatal: boolean; code: string | null; message: string | null }}
 */
export function classifyRealtimeError(event) {
  if (!event || typeof event !== "object") {
    return { ignorable: false, fatal: false, code: null, message: null };
  }

  const err =
    "error" in event && event.error && typeof event.error === "object"
      ? /** @type {Record<string, unknown>} */ (event.error)
      : null;

  const code =
    (typeof err?.code === "string" && err.code) ||
    (typeof err?.type === "string" && err.type) ||
    null;
  const message = typeof err?.message === "string" ? err.message : null;

  if (code && IGNORABLE_ERROR_CODES.has(code)) {
    return { ignorable: true, fatal: false, code, message };
  }

  if (message && /no active response|nothing to cancel|already canceled/i.test(message)) {
    return { ignorable: true, fatal: false, code, message };
  }

  if (code && FATAL_ERROR_CODES.has(code)) {
    return { ignorable: false, fatal: true, code, message };
  }

  return { ignorable: false, fatal: false, code, message };
}

/**
 * @param {unknown} event
 */
export function isCancelledOrFailedResponseDone(event) {
  if (!event || typeof event !== "object" || !("type" in event)) return false;
  if (event.type !== "response.done") return false;
  const response =
    "response" in event && event.response && typeof event.response === "object"
      ? /** @type {{ status?: string }} */ (event.response)
      : null;
  const status = response?.status;
  return status === "cancelled" || status === "canceled" || status === "failed";
}
