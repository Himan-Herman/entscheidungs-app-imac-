// server/services/auditLogService.js
// Fire-and-forget operational logging. Never pass medical narrative, PDF bytes, or raw AI output.
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { registryForAction } from "./activity/activityFeedRegistry.js";


const SENSITIVE_METADATA_KEYS =
  /^(password|token|secret|authorization|cookie|email|transcript|pdf|body|symptom|diagnosis|content|message|medication|lab|befund|thread|nachricht)$/i;

function getIpSalt() {
  return process.env.AUDIT_IP_SALT || process.env.JWT_SECRET || "medscoutx-audit-salt";
}

/**
 * @param {string | undefined} ip
 * @returns {string | null}
 */
export function hashClientIp(ip) {
  if (!ip || ip === "unknown") return null;
  const h = crypto.createHash("sha256");
  h.update(getIpSalt());
  h.update(":");
  h.update(String(ip).slice(0, 128));
  return h.digest("hex");
}

/**
 * Recursively strip risky keys and truncate strings for metadata JSON.
 * @param {unknown} value
 * @param {number} depth
 * @returns {unknown}
 */
export function sanitizeAuditMetadata(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const s = value.slice(0, 200);
    return s.length === value.length ? s : `${s}…`;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitizeAuditMetadata(v, depth + 1));
  }
  if (typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    const entries = Object.entries(value).slice(0, 25);
    for (const [k, v] of entries) {
      if (SENSITIVE_METADATA_KEYS.test(k)) continue;
      out[k] = sanitizeAuditMetadata(v, depth + 1);
    }
    return out;
  }
  return undefined;
}

/**
 * @param {{
 *   req?: import('express').Request;
 *   userId?: string | null;
 *   actorRole?: string | null;
 *   action: string;
 *   entityType?: string | null;
 *   entityId?: string | null;
 *   practiceProfileId?: string | null;
 *   patientUserId?: string | null;
 *   practicePatientLinkId?: string | null;
 *   severity?: string | null;
 *   visibility?: string | null;
 *   metadata?: Record<string, unknown> | null;
 * }} opts
 */
function buildAuditRow(opts) {
  const {
    req,
    userId = null,
    actorRole = null,
    action,
    entityType = null,
    entityId = null,
    metadata = null,
  } = opts;

  const metaObj =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};

  const reg = registryForAction(action);
  const practiceProfileId =
    opts.practiceProfileId ??
    (typeof metaObj.practiceProfileId === "string" ? metaObj.practiceProfileId : null);
  const patientUserId =
    opts.patientUserId ??
    (typeof metaObj.patientUserId === "string" ? metaObj.patientUserId : null);
  const practicePatientLinkId =
    opts.practicePatientLinkId ??
    (typeof metaObj.practicePatientLinkId === "string" ? metaObj.practicePatientLinkId : null);
  const severity = opts.severity || reg?.severity || "info";
  const visibility = opts.visibility || reg?.visibility || "internal";

  const ip =
    req?.headers?.["x-forwarded-for"]?.split?.(",")?.[0]?.trim?.() ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    "";
  const ipHash = hashClientIp(ip);
  const ua =
    typeof req?.headers?.["user-agent"] === "string"
      ? req.headers["user-agent"].slice(0, 400)
      : null;

  let metaJson = null;
  if (metadata && typeof metadata === "object") {
    try {
      metaJson = sanitizeAuditMetadata(metadata);
    } catch {
      metaJson = null;
    }
  }

  return {
    userId: userId || null,
    actorRole: actorRole || null,
    action,
    entityType: entityType || null,
    entityId: entityId || null,
    practiceProfileId,
    patientUserId,
    practicePatientLinkId,
    severity,
    visibility,
    ipHash,
    userAgent: ua,
    metadata: metaJson ?? undefined,
  };
}

/**
 * BEST EFFORT. Fire-and-forget: returns undefined (NOT a promise) and swallows
 * write failures silently. Never `await` this and never chain `.catch()` on it.
 *
 * Appropriate for observational events (something was viewed, opened, listed)
 * where losing a row is acceptable and must not fail the request.
 * For security-relevant mutations use writeRequiredAuditLog instead.
 */
export function writeAuditLog(opts) {
  void prisma.auditLog.create({ data: buildAuditRow(opts) }).catch(() => {
    /* silent */
  });
}

/**
 * MANDATORY audit. Returns a promise and REJECTS if the row could not be
 * written, so a caller can refuse to report success for a security-relevant
 * mutation that was not recorded.
 *
 * Use for: issuing/cancelling a prescription, creating/activating/revoking a
 * care link, granting/revoking consent, exporting or sharing patient data.
 *
 * ATOMICITY
 * ---------
 * Awaiting this AFTER the mutation has committed is not enough: the audit can
 * fail while the change stands, leaving the request to report an error for an
 * operation that actually happened. Pass the transaction client so the audit row
 * and the mutation share one transaction and fail together — see
 * `withRequiredAudit()` below, which is the intended way to do it.
 *
 * `client` defaults to the shared Prisma singleton, so existing callers outside
 * a transaction keep working unchanged.
 *
 * @param {Parameters<typeof writeAuditLog>[0]} opts
 * @param {{ auditLog: { create: Function } }} [client] Prisma client or transaction client
 * @returns {Promise<void>}
 */
export async function writeRequiredAuditLog(opts, client = prisma) {
  await client.auditLog.create({ data: buildAuditRow(opts) });
}

/**
 * Runs a security-relevant mutation and its mandatory audit in ONE transaction.
 *
 * The invariant this exists for: an operation whose audit is mandatory must not
 * be able to persist while its audit row does not. Postgres decides — if the
 * audit insert fails, the mutation is rolled back with it, and the caller sees
 * an error for something that genuinely did not happen.
 *
 * Follows the two conventions already in this codebase: interactive
 * `prisma.$transaction(async (tx) => ...)` (visitMedicationService,
 * interpreterCloudSessionRepository) and passing a Prisma-or-transaction client
 * into a helper (contextualPatientDataDeletionGuard).
 *
 * The audit row is written LAST so it can describe the result — the mutation's
 * return value is handed to `auditFor`.
 *
 * Side effects that cannot be rolled back — e-mail, webhooks, external calls —
 * must stay OUTSIDE this wrapper, after it resolves.
 *
 * @template T
 * @param {(tx: object) => Promise<T>} mutate runs inside the transaction
 * @param {(result: T) => Parameters<typeof writeAuditLog>[0]} auditFor builds the audit row from the result
 * @returns {Promise<T>}
 */
export async function withRequiredAudit(mutate, auditFor) {
  return prisma.$transaction(async (tx) => {
    const result = await mutate(tx);
    await writeRequiredAuditLog(auditFor(result), tx);
    return result;
  });
}
