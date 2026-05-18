import { writeAuditLog, sanitizeAuditMetadata } from "../auditLogService.js";

/** @type {Map<string, number>} */
const throttleUntil = new Map();
const THROTTLE_MS = 60_000;

/**
 * Standardized security audit row — metadata only, no clinical content or secrets.
 * @param {{
 *   req?: import('express').Request;
 *   userId?: string | null;
 *   actorRole?: string | null;
 *   eventType: string;
 *   practiceProfileId?: string | null;
 *   patientUserId?: string | null;
 *   practicePatientLinkId?: string | null;
 *   entityId?: string | null;
 *   metadata?: Record<string, unknown> | null;
 * }} opts
 */
export function logSecurityEvent(opts) {
  const eventType = String(opts.eventType || "unknown").slice(0, 80);
  writeAuditLog({
    req: opts.req,
    userId: opts.userId ?? null,
    actorRole: opts.actorRole ?? null,
    action: "security_event",
    entityType: "security_event",
    entityId: opts.entityId || eventType,
    practiceProfileId: opts.practiceProfileId ?? null,
    patientUserId: opts.patientUserId ?? null,
    practicePatientLinkId: opts.practicePatientLinkId ?? null,
    severity: "security",
    visibility: "internal",
    metadata: sanitizeAuditMetadata({
      eventType,
      ...(opts.metadata && typeof opts.metadata === "object" ? opts.metadata : {}),
    }),
  });
}

/**
 * Rate-limit noisy security logs (e.g. repeated invalid tokens per IP).
 * @param {string} throttleKey
 * @param {Parameters<typeof logSecurityEvent>[0]} opts
 */
export function logSecurityEventThrottled(throttleKey, opts) {
  const key = String(throttleKey || "global").slice(0, 120);
  const now = Date.now();
  const until = throttleUntil.get(key) || 0;
  if (now < until) return;
  throttleUntil.set(key, now + THROTTLE_MS);
  logSecurityEvent(opts);
}
