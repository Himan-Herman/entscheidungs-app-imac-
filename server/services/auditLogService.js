// server/services/auditLogService.js
// Fire-and-forget operational logging. Never pass medical narrative, PDF bytes, or raw AI output.
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { registryForAction } from "./activity/activityFeedRegistry.js";

const prisma = new PrismaClient();

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
export function writeAuditLog(opts) {
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

  void prisma.auditLog
    .create({
      data: {
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
      },
    })
    .catch(() => {
      /* silent */
    });
}
