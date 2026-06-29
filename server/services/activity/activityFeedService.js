import { prisma } from "../../lib/prisma.js";
import { registryForAction } from "./activityFeedRegistry.js";


const PRACTICE_VISIBILITIES = ["practice_visible", "patient_visible"];
const PATIENT_VISIBILITIES = ["patient_visible"];

/**
 * @param {import("@prisma/client").AuditLog} row
 * @param {'practice' | 'patient'} audience
 */
function auditToActivityEvent(row, audience) {
  const reg = registryForAction(row.action);
  if (!reg) return null;
  if (reg.visibility === "internal") return null;

  if (audience === "practice") {
    if (!PRACTICE_VISIBILITIES.includes(reg.visibility)) return null;
    if (reg.audience === "patient" && row.actorRole === "patient") {
      // still show patient-initiated events to practice
    }
  }
  if (audience === "patient") {
    if (!PATIENT_VISIBILITIES.includes(reg.visibility)) return null;
  }

  /** @type {Record<string, unknown> | null} */
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : null;

  let type = reg.activityType;
  if (row.action === "practice_thread_message_sent") {
    type = audience === "patient" ? "message_received" : "message_sent";
  } else if (row.action === "patient_thread_message_sent") {
    type = audience === "patient" ? "message_sent" : "message_received";
  }

  return {
    id: row.id,
    type,
    action: row.action,
    occurredAt: row.createdAt,
    actorRole: row.actorRole || "system",
    severity: row.severity || reg.severity || "info",
    practiceProfileId: row.practiceProfileId || meta?.practiceProfileId || null,
    practicePatientLinkId: row.practicePatientLinkId || meta?.practicePatientLinkId || null,
    resourceType: row.entityType || null,
    resourceId: row.entityId || null,
    unread: false,
  };
}

/**
 * @param {import("@prisma/client").AuditLog[]} rows
 * @param {'practice' | 'patient'} audience
 * @param {{ type?: string, q?: string, from?: Date, to?: Date }} filters
 */
function filterEvents(rows, audience, filters = {}) {
  let events = rows
    .map((r) => auditToActivityEvent(r, audience))
    .filter(Boolean);

  if (filters.type) {
    events = events.filter((e) => e.type === filters.type);
  }
  if (filters.from) {
    const t = filters.from.getTime();
    events = events.filter((e) => new Date(e.occurredAt).getTime() >= t);
  }
  if (filters.to) {
    const t = filters.to.getTime();
    events = events.filter((e) => new Date(e.occurredAt).getTime() <= t);
  }
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    events = events.filter(
      (e) =>
        e.type.toLowerCase().includes(needle) ||
        (e.action && e.action.toLowerCase().includes(needle)),
    );
  }

  events.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  return events.slice(0, 80);
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {{ type?: string, q?: string, from?: string, to?: string }} query
 */
export async function listPracticeLinkActivity(linkId, practiceProfileId, query = {}) {
  const lid = String(linkId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  if (!lid || !pid) throw new Error("validation_required");

  const link = await prisma.practicePatientLink.findFirst({
    where: { id: lid, practiceProfileId: pid },
  });
  if (!link) throw new Error("link_not_found");

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [
        { practicePatientLinkId: lid },
        {
          AND: [
            { entityType: { in: ["practice_patient_link", "PracticePatientLink", "patient_profile"] } },
            { entityId: lid },
          ],
        },
        {
          AND: [
            { patientUserId: link.patientUserId },
            { practiceProfileId: pid },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const events = filterEvents(rows, "practice", {
    type: query.type,
    q: query.q,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  });

  return { events, linkId: lid, practiceProfileId: pid };
}

/**
 * @param {string} patientUserId
 * @param {{ type?: string, q?: string, from?: string, to?: string, linkId?: string }} query
 */
export async function listPatientActivity(patientUserId, query = {}) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  const linkId = query.linkId ? String(query.linkId).trim() : null;

  const where = {
    patientUserId: uid,
    ...(linkId ? { practicePatientLinkId: linkId } : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const events = filterEvents(rows, "patient", {
    type: query.type,
    q: query.q,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  });

  const practices = await prisma.practicePatientLink.findMany({
    where: { patientUserId: uid },
    select: {
      id: true,
      practiceProfile: { select: { id: true, practiceName: true } },
    },
  });

  return {
    events,
    practices: practices.map((l) => ({
      linkId: l.id,
      practice: l.practiceProfile,
    })),
  };
}

/**
 * Internal practice audit log (includes security/internal events).
 * @param {string} practiceProfileId
 * @param {{ severity?: string, from?: string, to?: string, limit?: number }} query
 */
export async function listPracticeAuditLog(practiceProfileId, query = {}) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("validation_required");

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200);

  const createdAtFilter = {};
  if (from && !Number.isNaN(from.getTime())) createdAtFilter.gte = from;
  if (to && !Number.isNaN(to.getTime())) createdAtFilter.lte = to;

  const rows = await prisma.auditLog.findMany({
    where: {
      practiceProfileId: pid,
      ...(query.severity ? { severity: query.severity } : {}),
      ...(Object.keys(createdAtFilter).length ? { createdAt: createdAtFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      actorRole: true,
      action: true,
      entityType: true,
      entityId: true,
      practiceProfileId: true,
      patientUserId: true,
      practicePatientLinkId: true,
      severity: true,
      visibility: true,
      createdAt: true,
      metadata: true,
    },
  });

  return {
    entries: rows.map((r) => ({
      id: r.id,
      actorUserId: r.userId,
      actorRole: r.actorRole,
      action: r.action,
      resourceType: r.entityType,
      resourceId: r.entityId,
      practiceProfileId: r.practiceProfileId,
      patientUserId: r.patientUserId,
      practicePatientLinkId: r.practicePatientLinkId,
      severity: r.severity,
      visibility: r.visibility,
      createdAt: r.createdAt,
      metadata: r.metadata,
    })),
  };
}
