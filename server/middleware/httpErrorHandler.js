/**
 * Central Express error handler — safe JSON in production, no stack traces to clients.
 */

import { sendSafeJsonError, logServerError } from "../utils/safeApiError.js";

/**
 * @type {import('express').ErrorRequestHandler}
 */
export function httpErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }
  logServerError("unhandled_route", err, req);
  const status =
    typeof err?.status === "number"
      ? err.status
      : typeof err?.statusCode === "number"
        ? err.statusCode
        : 500;
  sendSafeJsonError(
    res,
    status,
    err?.code && typeof err.code === "string" ? err.code : "internal_error",
    undefined,
  );
}
