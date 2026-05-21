/**
 * Consistent JSON error responses for interpreter cloud routes.
 * Never include stack traces, SQL, prompts, or conversation text.
 */

export const CLOUD_DISABLED_BODY = {
  ok: false,
  error: "interpreter_cloud_disabled",
  message: "Interpreter cloud storage is not available.",
};

export const CLOUD_UNAUTHORIZED_BODY = {
  ok: false,
  error: "unauthorized",
  message: "Authentication required.",
};

export const CLOUD_PAYLOAD_TOO_LARGE_BODY = {
  ok: false,
  error: "validation_payload_too_large",
  message: "Request body is too large.",
};

export const CLOUD_GENERIC_500 = {
  ok: false,
  error: "generic",
  message: "Request could not be completed.",
};

/**
 * @param {import('express').Response} res
 * @param {{ ok: false; code?: string; message?: string; statusCode?: number }} result
 */
export function sendCloudServiceError(res, result) {
  return res.status(result.statusCode || 400).json({
    ok: false,
    error: result.code || "generic",
    message: result.message || CLOUD_GENERIC_500.message,
  });
}

/**
 * @param {import('express').Response} res
 * @param {{ ok: false; code?: string; message?: string; statusCode?: number }} result
 */
export function sendCloudValidationError(res, result) {
  const status = result.statusCode || 400;
  return res.status(status).json({
    ok: false,
    error: result.code || "validation_error",
    message: result.message || "Invalid request.",
  });
}

/**
 * @param {import('express').Response} res
 * @param {string} message
 */
export function sendCloudGeneric500(res, message = CLOUD_GENERIC_500.message) {
  return res.status(500).json({
    ok: false,
    error: "generic",
    message,
  });
}
