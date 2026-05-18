import { PrismaClient } from "@prisma/client";
import { sanitizeAuditMetadata } from "../auditLogService.js";

const prisma = new PrismaClient();

export const AUDIT_ACTOR_ROLES = new Set(["practice", "patient", "system"]);
export const AUDIT_RESOURCE_TYPES = new Set([
  "practice_document",
  "document_file",
  "document_share",
]);
export const AUDIT_ACTIONS = new Set([
  "deleted",
  "archived",
  "share_revoked",
  "file_deleted",
]);

const MAX_REASON_LEN = 500;

/**
 * Allowed metadata keys only — no clinical narrative or file contents.
 * @param {Record<string, unknown>} raw
 */
function allowlistedMetadata(raw) {
  const allowed = [
    "documentType",
    "fileCount",
    "originalFileName",
    "mimeType",
    "sizeBytes",
    "shareId",
    "previousStatus",
  ];
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of allowed) {
    if (raw[key] !== undefined && raw[key] !== null) {
      out[key] = raw[key];
    }
  }
  return sanitizeAuditMetadata(out);
}

/**
 * @param {{
 *   actorUserId: string;
 *   actorRole: string;
 *   practiceProfileId?: string | null;
 *   patientUserId?: string | null;
 *   resourceType: string;
 *   resourceId: string;
 *   action: string;
 *   reason?: string | null;
 *   metadata?: Record<string, unknown> | null;
 * }} entry
 */
export async function writePracticeDocumentAudit(entry) {
  if (!AUDIT_ACTOR_ROLES.has(entry.actorRole)) {
    throw new Error("validation_invalid_actor_role");
  }
  if (!AUDIT_RESOURCE_TYPES.has(entry.resourceType)) {
    throw new Error("validation_invalid_resource_type");
  }
  if (!AUDIT_ACTIONS.has(entry.action)) {
    throw new Error("validation_invalid_action");
  }

  const reason = entry.reason
    ? String(entry.reason).trim().slice(0, MAX_REASON_LEN) || null
    : null;

  return prisma.practiceDocumentAuditEntry.create({
    data: {
      actorUserId: entry.actorUserId,
      actorRole: entry.actorRole,
      practiceProfileId: entry.practiceProfileId ?? null,
      patientUserId: entry.patientUserId ?? null,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      action: entry.action,
      reason,
      metadataJson: entry.metadata ? allowlistedMetadata(entry.metadata) : undefined,
    },
  });
}
