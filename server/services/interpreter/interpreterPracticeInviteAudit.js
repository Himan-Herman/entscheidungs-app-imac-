import { writeAuditLog } from "../auditLogService.js";

const SAFE_METADATA_KEYS = new Set([
  "result",
  "requestId",
  "code",
  "inviteId",
  "practiceProfileId",
  "inviteType",
  "usageCount",
  "maxUses",
  "state",
]);

/**
 * @param {Record<string, unknown> | undefined} metadata
 */
export function sanitizeInviteAuditMetadata(metadata) {
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
 * @param {{
 *   req?: import('express').Request;
 *   userId?: string | null;
 *   practiceProfileId?: string | null;
 *   action: string;
 *   entityId?: string | null;
 *   result: 'ok' | 'denied' | 'failed';
 *   metadata?: Record<string, unknown>;
 * }} opts
 */
export function auditInterpreterPracticeInvite(opts) {
  const {
    req,
    userId = null,
    practiceProfileId = null,
    action,
    entityId = null,
    result,
    metadata = {},
  } = opts;
  const requestId =
    typeof req?.requestId === "string" ? req.requestId : undefined;

  writeAuditLog({
    req,
    userId: userId || undefined,
    actorRole: userId ? "practice" : "system",
    action,
    entityType: "interpreter_practice_invite",
    entityId,
    practiceProfileId: practiceProfileId || undefined,
    visibility: "internal",
    severity: result === "failed" ? "warning" : "info",
    metadata: sanitizeInviteAuditMetadata({
      result,
      ...(requestId ? { requestId } : {}),
      ...(practiceProfileId ? { practiceProfileId } : {}),
      ...metadata,
    }),
  });
}
