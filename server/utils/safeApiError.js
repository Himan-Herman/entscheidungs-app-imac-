// server/utils/safeApiError.js
// Never return Prisma stack traces, OpenAI payloads, or medical text to clients.

const isProd = process.env.NODE_ENV === "production";

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} [clientMessage] — safe, user-facing (EN is fine; app may localize)
 */
export function sendSafeJsonError(res, status, code, clientMessage) {
  return res.status(status).json({
    ok: false,
    error: code,
    message: clientMessage || (isProd ? "Request could not be completed." : "server_error"),
  });
}

/**
 * @param {string} context
 * @param {unknown} err
 * @param {import('express').Request} [req]
 */
export function logServerError(context, err, req) {
  const requestId =
    req && typeof req.requestId === "string" ? req.requestId : undefined;
  if (isProd) {
    console.error(
      JSON.stringify({
        level: "error",
        context,
        requestId,
        name: err?.name || "Error",
      }),
    );
  } else {
    console.error(`[${context}]`, requestId || "", err);
  }
}
