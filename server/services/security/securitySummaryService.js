import { PrismaClient } from "@prisma/client";
import { listPracticeAuditLog } from "../activity/activityFeedService.js";
import { SECURITY_PRINCIPLES } from "./securityPrinciples.js";

const prisma = new PrismaClient();

/**
 * @param {import("@prisma/client").AuditLog} row
 */
function securityEventToJson(row) {
  /** @type {Record<string, unknown> | null} */
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : null;
  const eventType =
    typeof meta?.eventType === "string" ? meta.eventType : row.action || "security_event";

  return {
    id: row.id,
    eventType,
    action: row.action,
    occurredAt: row.createdAt || row.occurredAt,
    actorRole: row.actorRole || "system",
    entityType: row.entityType,
    entityId: row.entityId,
  };
}

/**
 * Practice security overview — metadata only, no patient clinical content.
 * @param {string} practiceProfileId
 */
export async function getSecuritySummary(practiceProfileId) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("validation_required");

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    securityEvents7d,
    openDataRequests,
    revokedSecureLinks,
    activePatientLinks,
    archivedPatientLinks,
    activeConsents,
    expiredConsents,
  ] = await Promise.all([
    prisma.auditLog.count({
      where: { practiceProfileId: pid, severity: "security", createdAt: { gte: since7d } },
    }),
    prisma.patientDataRequest.count({
      where: {
        practiceProfileId: pid,
        status: { in: ["submitted", "in_review"] },
      },
    }),
    prisma.secureDocumentAccessToken.count({
      where: { practiceProfileId: pid, revokedAt: { not: null } },
    }),
    prisma.practicePatientLink.count({
      where: { practiceProfileId: pid, status: "active" },
    }),
    prisma.practicePatientLink.count({
      where: { practiceProfileId: pid, status: "archived" },
    }),
    prisma.consentRecord.count({
      where: { practiceProfileId: pid, status: "granted" },
    }),
    prisma.consentRecord.count({
      where: { practiceProfileId: pid, status: "expired" },
    }),
  ]);

  const audit = await listPracticeAuditLog(pid, { severity: "security", limit: 12 });

  return {
    principles: SECURITY_PRINCIPLES,
    metrics: {
      securityEvents7d,
      openDataRequests,
      revokedSecureLinks,
      activePatientLinks,
      archivedPatientLinks,
      activeConsents,
      expiredConsents,
    },
    recentSecurityEvents: (audit.entries || []).map(securityEventToJson),
  };
}

/**
 * @param {string} practiceProfileId
 * @param {{ limit?: number, from?: string, to?: string }} query
 */
export async function listSecurityEvents(practiceProfileId, query = {}) {
  const result = await listPracticeAuditLog(practiceProfileId, {
    severity: "security",
    from: query.from,
    to: query.to,
    limit: query.limit || 100,
  });
  return {
    events: (result.entries || []).map(securityEventToJson),
    total: result.total ?? result.entries?.length ?? 0,
  };
}
