import { PrismaClient } from "@prisma/client";
import {
  isMedicalInterpreterB2bEnabled,
  isPracticeAnamnesisEnabled,
  isPracticeBookingEnabled,
  isTelemedicineUiEnabled,
} from "../../config/featureFlags.js";
import {
  hasPracticePermission,
  permissionsForRole,
  PERMISSIONS,
} from "../../utils/practicePermissions.js";
import { registryForAction } from "../activity/activityFeedRegistry.js";

const prisma = new PrismaClient();

const OPEN_DATA_REQUEST_STATUSES = ["submitted", "in_review"];
const RECENT_DOCUMENT_DAYS = 14;
const RECENT_MEDICATION_DAYS = 30;

/** @type {Record<string, string>} */
const DASHBOARD_ACTIVITY_TYPE_MAP = {
  patient_thread_message_sent: "message",
  practice_thread_message_sent: "message",
  practice_document_shared: "document_shared",
  medication_plan_published: "medication_published",
  patient_profile_access_granted: "profile_access_changed",
  profile_access_granted: "profile_access_changed",
  patient_profile_access_revoked: "profile_access_changed",
  profile_access_revoked: "profile_access_changed",
  patient_data_request_submitted: "data_request",
  patient_data_export_request_submitted: "data_request",
  practice_patient_link_archived: "relationship_archived",
  practice_patient_link_archived_by_patient: "relationship_archived",
};

const DASHBOARD_ACTIVITY_ACTIONS = Object.keys(DASHBOARD_ACTIVITY_TYPE_MAP);

/**
 * @param {string} practiceProfileId
 * @param {string} role
 */
function metricsVisibilityForRole(role) {
  return {
    inbox: hasPracticePermission(role, PERMISSIONS.INBOX_MANAGE),
    messages: hasPracticePermission(role, PERMISSIONS.MESSAGES_SEND),
    dataRequests: hasPracticePermission(role, PERMISSIONS.DATA_REQUESTS_MANAGE),
    patients: hasPracticePermission(role, PERMISSIONS.PATIENT_LINKS_READ),
    documents: hasPracticePermission(role, PERMISSIONS.DOCUMENTS_READ),
    medication: hasPracticePermission(role, PERMISSIONS.MEDICATION_READ),
    team: hasPracticePermission(role, PERMISSIONS.TEAM_VIEW),
    audit: hasPracticePermission(role, PERMISSIONS.AUDIT_VIEW),
    security: hasPracticePermission(role, PERMISSIONS.SECURITY_VIEW),
    billing: hasPracticePermission(role, PERMISSIONS.SETTINGS_MANAGE),
    interpreter:
      isMedicalInterpreterB2bEnabled() &&
      hasPracticePermission(role, PERMISSIONS.INTERPRETER_VIEW),
    anamnesis:
      isPracticeAnamnesisEnabled() &&
      hasPracticePermission(role, PERMISSIONS.ANAMNESIS_READ),
    booking:
      isPracticeBookingEnabled() &&
      hasPracticePermission(role, PERMISSIONS.BOOKING_READ),
    telemedicine:
      isTelemedicineUiEnabled() &&
      hasPracticePermission(role, PERMISSIONS.TELEMEDICINE_READ),
  };
}

/**
 * @param {string} practiceProfileId
 * @param {string} role
 */
export async function getPracticeDashboardSummary(practiceProfileId, role) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("practiceId_required");

  const visibility = metricsVisibilityForRole(role);
  const sinceDoc = new Date(Date.now() - RECENT_DOCUMENT_DAYS * 24 * 60 * 60 * 1000);
  const sinceMed = new Date(Date.now() - RECENT_MEDICATION_DAYS * 24 * 60 * 60 * 1000);

  // Owner is implicit (PracticeProfile.userId) and always counts as one active team
  // member; loaded only for the optional team KPIs (team-visible roles only).
  const ownerUserId = visibility.team
    ? (
        await prisma.practiceProfile.findUnique({
          where: { id: pid },
          select: { userId: true },
        })
      )?.userId || null
    : null;

  const [
    unreadInboxItems,
    openMessages,
    openDataRequests,
    activePatientLinks,
    newDocumentShares,
    publishedMedicationPlans,
    recentlyActivePatients,
    activeTeamMembersExclOwner,
    pendingInvites,
  ] = await Promise.all([
    visibility.inbox
      ? prisma.practiceInboxItem.count({
          where: { practiceProfileId: pid, status: "new" },
        })
      : Promise.resolve(null),
    visibility.messages
      ? prisma.practicePatientMessage.count({
          where: {
            senderType: "patient",
            readAt: null,
            thread: { practiceProfileId: pid, archivedAt: null },
          },
        })
      : Promise.resolve(null),
    visibility.dataRequests
      ? prisma.patientDataRequest.count({
          where: {
            practiceProfileId: pid,
            status: { in: OPEN_DATA_REQUEST_STATUSES },
          },
        })
      : Promise.resolve(null),
    visibility.patients
      ? prisma.practicePatientLink.count({
          where: { practiceProfileId: pid, status: "active" },
        })
      : Promise.resolve(null),
    visibility.documents
      ? prisma.practiceDocument.count({
          where: {
            practiceProfileId: pid,
            status: "shared",
            sharedAt: { gte: sinceDoc },
            deletedAt: null,
          },
        })
      : Promise.resolve(null),
    visibility.medication
      ? prisma.medicationPlan.count({
          where: {
            practiceProfileId: pid,
            status: "published",
            publishedAt: { gte: sinceMed },
            deletedAt: null,
          },
        })
      : Promise.resolve(null),
    visibility.patients ? loadRecentlyActivePatients(pid, 5) : Promise.resolve([]),
    visibility.team
      ? prisma.practiceMember.count({
          where: { practiceProfileId: pid, status: "active", userId: { not: ownerUserId } },
        })
      : Promise.resolve(null),
    visibility.team
      ? prisma.practiceMember.count({
          where: { practiceProfileId: pid, status: "invited" },
        })
      : Promise.resolve(null),
  ]);

  return {
    practiceProfileId: pid,
    role,
    permissions: permissionsForRole(role),
    visibility,
    metrics: {
      unreadInboxItems,
      openMessages,
      openDataRequests,
      activePatientLinks,
      newDocumentShares,
      publishedMedicationPlans,
      recentlyActivePatients,
      memberCount:
        activeTeamMembersExclOwner == null
          ? null
          : activeTeamMembersExclOwner + (ownerUserId ? 1 : 0),
      pendingInvites,
    },
    quickActions: buildQuickActions(role),
  };
}

/**
 * @param {string} practiceProfileId
 * @param {number} limit
 */
async function loadRecentlyActivePatients(practiceProfileId, limit) {
  const links = await prisma.practicePatientLink.findMany({
    where: { practiceProfileId, status: "active" },
    select: {
      id: true,
      patientUserId: true,
      updatedAt: true,
    },
    take: 80,
  });
  if (!links.length) return [];

  const linkIds = links.map((l) => l.id);
  const userIds = [...new Set(links.map((l) => l.patientUserId))];

  const [docMax, threadMax, visitMax] = await Promise.all([
    prisma.practiceDocument.groupBy({
      by: ["practicePatientLinkId"],
      where: { practicePatientLinkId: { in: linkIds } },
      _max: { updatedAt: true },
    }),
    prisma.practicePatientThread.groupBy({
      by: ["practicePatientLinkId"],
      where: { practicePatientLinkId: { in: linkIds } },
      _max: { updatedAt: true },
    }),
    prisma.preVisitSession.groupBy({
      by: ["userId"],
      where: { practiceProfileId, userId: { in: userIds } },
      _max: { updatedAt: true },
    }),
  ]);

  const docMaxMap = Object.fromEntries(
    docMax.map((r) => [r.practicePatientLinkId, r._max.updatedAt]),
  );
  const threadMaxMap = Object.fromEntries(
    threadMax.map((r) => [r.practicePatientLinkId, r._max.updatedAt]),
  );
  const visitByUser = Object.fromEntries(visitMax.map((r) => [r.userId, r._max.updatedAt]));

  const enriched = links.map((link) => {
    let lastActivityAt = link.updatedAt;
    const docAt = docMaxMap[link.id];
    const threadAt = threadMaxMap[link.id];
    const visitAt = visitByUser[link.patientUserId];
    if (docAt && (!lastActivityAt || docAt > lastActivityAt)) lastActivityAt = docAt;
    if (threadAt && (!lastActivityAt || threadAt > lastActivityAt)) lastActivityAt = threadAt;
    if (visitAt && (!lastActivityAt || visitAt > lastActivityAt)) lastActivityAt = visitAt;
    return {
      linkId: link.id,
      lastActivityAt,
    };
  });

  enriched.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
  return enriched.slice(0, limit);
}

/**
 * @param {string} role
 */
function buildQuickActions(role) {
  return {
    searchPatient: hasPracticePermission(role, PERMISSIONS.PATIENT_LINKS_READ),
    openInbox: hasPracticePermission(role, PERMISSIONS.INBOX_MANAGE),
    newMessage: hasPracticePermission(role, PERMISSIONS.MESSAGES_SEND),
    uploadDocument: hasPracticePermission(role, PERMISSIONS.DOCUMENTS_WRITE),
    createMedicationPlan: hasPracticePermission(role, PERMISSIONS.MEDICATION_WRITE),
    manageTeam: hasPracticePermission(role, PERMISSIONS.TEAM_MANAGE),
    openSettings: hasPracticePermission(role, PERMISSIONS.SETTINGS_MANAGE),
    openIntegrations: hasPracticePermission(role, PERMISSIONS.INTEGRATIONS_MANAGE),
    openCalendar: hasPracticePermission(role, PERMISSIONS.CALENDAR_READ),
    openDeveloper: hasPracticePermission(role, PERMISSIONS.INTEGRATIONS_MANAGE),
    openSecurity: hasPracticePermission(role, PERMISSIONS.SECURITY_VIEW),
    openBillingPlausibility: hasPracticePermission(role, PERMISSIONS.SETTINGS_MANAGE),
  };
}

/**
 * @param {import("@prisma/client").AuditLog} row
 */
function auditRowToDashboardActivity(row) {
  const mapped = DASHBOARD_ACTIVITY_TYPE_MAP[row.action];
  if (!mapped) return null;
  const reg = registryForAction(row.action);
  if (reg?.visibility === "internal") return null;

  return {
    id: row.id,
    type: mapped,
    action: row.action,
    occurredAt: row.createdAt,
    practicePatientLinkId: row.practicePatientLinkId || null,
  };
}

/**
 * @param {string} practiceProfileId
 * @param {{ limit?: number }} opts
 */
export async function listPracticeDashboardRecentActivity(practiceProfileId, opts = {}) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("practiceId_required");
  const limit = Math.min(Math.max(Number(opts.limit) || 12, 1), 30);

  const rows = await prisma.auditLog.findMany({
    where: {
      practiceProfileId: pid,
      action: { in: DASHBOARD_ACTIVITY_ACTIONS },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      action: true,
      createdAt: true,
      practicePatientLinkId: true,
    },
  });

  const events = rows
    .map(auditRowToDashboardActivity)
    .filter(Boolean)
    .slice(0, limit);

  return { events, practiceProfileId: pid };
}
