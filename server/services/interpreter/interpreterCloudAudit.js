import { writeAuditLog } from "../auditLogService.js";

/** Allowed audit metadata keys — no transcript, audio, or clinical fields. */
const SAFE_METADATA_KEYS = new Set([
  "result",
  "requestId",
  "code",
  "reason",
  "consentVersion",
  "deleteCloudData",
  "deletedSessionCount",
  "sessionCount",
  "turnCount",
  "charCount",
  "clientSessionId",
  "contentLength",
  "exportWarning",
]);

/**
 * Strip unsafe or verbose values from audit metadata.
 * @param {Record<string, unknown> | undefined} metadata
 */
export function sanitizeCloudAuditMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  /** @type {Record<string, unknown>} */
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (value == null) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      if (typeof value === "string" && value.length > 256) continue;
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Operational audit for interpreter cloud — never pass transcript or turn text.
 * @param {{
 *   req?: import('express').Request;
 *   userId: string;
 *   action: string;
 *   entityId?: string | null;
 *   result: 'ok' | 'denied' | 'failed';
 *   metadata?: Record<string, unknown>;
 * }} opts
 */
export function auditInterpreterCloud(opts) {
  const { req, userId, action, entityId = null, result, metadata = {} } = opts;
  const requestId =
    typeof req?.requestId === "string" ? req.requestId : undefined;

  writeAuditLog({
    req,
    userId,
    actorRole: "patient",
    action,
    entityType: "interpreter_cloud_session",
    entityId,
    visibility: "internal",
    severity: result === "failed" ? "warning" : "info",
    metadata: sanitizeCloudAuditMetadata({
      result,
      ...(requestId ? { requestId } : {}),
      ...metadata,
    }),
  });
}
