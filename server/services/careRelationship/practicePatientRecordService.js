import { PrismaClient } from "@prisma/client";
import { linkHasConsentScope } from "./consentScopes.js";
import { getPracticePatientLink } from "./practicePatientLinkService.js";

const prisma = new PrismaClient();

/**
 * @param {Date | string | null | undefined} a
 * @param {Date | string | null | undefined} b
 */
function maxDate(a, b) {
  if (!a) return b ? new Date(b) : null;
  if (!b) return new Date(a);
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return da >= db ? new Date(a) : new Date(b);
}

/**
 * @param {import("@prisma/client").PracticePatientLink} link
 */
export async function getPracticePatientOverview(linkId, practiceProfileId) {
  const row = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
  });
  if (!row) throw new Error("link_not_found");

  const uid = row.patientUserId;
  const pid = row.practiceProfileId;

  const [
    docCount,
    messageCount,
    preVisitCount,
    lastMessage,
    lastShare,
    lastPlan,
    lastPreVisit,
    openDataRequest,
  ] = await Promise.all([
    prisma.practiceDocument.count({
      where: { practicePatientLinkId: linkId, status: "shared" },
    }),
    prisma.practicePatientMessage.count({
      where: { thread: { practicePatientLinkId: linkId } },
    }),
    prisma.preVisitSession.count({
      where: { practiceProfileId: pid, userId: uid },
    }),
    prisma.practicePatientMessage.findFirst({
      where: { thread: { practicePatientLinkId: linkId } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.practiceDocumentShare.findFirst({
      where: { document: { practicePatientLinkId: linkId } },
      orderBy: { sharedAt: "desc" },
      select: { sharedAt: true },
    }),
    prisma.medicationPlan.findFirst({
      where: { practicePatientLinkId: linkId, status: "published" },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true, updatedAt: true, title: true },
    }),
    prisma.preVisitSession.findFirst({
      where: { practiceProfileId: pid, userId: uid },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, completedAt: true, openedAt: true, title: true },
    }),
    prisma.patientDataRequest.findFirst({
      where: {
        practicePatientLinkId: linkId,
        status: { in: ["submitted", "in_review"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, status: true, createdAt: true },
    }),
  ]);

  const lastDocumentSharedAt = lastShare?.sharedAt || null;
  const lastMedicationPlanPublishedAt =
    lastPlan?.publishedAt || lastPlan?.updatedAt || null;
  const lastPreVisitAt =
    lastPreVisit?.completedAt ||
    lastPreVisit?.openedAt ||
    lastPreVisit?.updatedAt ||
    null;

  let lastActivityAt = row.updatedAt;
  lastActivityAt = maxDate(lastActivityAt, lastMessage?.createdAt);
  lastActivityAt = maxDate(lastActivityAt, lastDocumentSharedAt);
  lastActivityAt = maxDate(lastActivityAt, lastMedicationPlanPublishedAt);
  lastActivityAt = maxDate(lastActivityAt, lastPreVisitAt);

  return {
    lastActivityAt,
    lastMessageAt: lastMessage?.createdAt || null,
    lastDocumentSharedAt,
    lastMedicationPlanPublishedAt,
    lastMedicationPlanTitle: lastPlan?.title || null,
    lastPreVisitAt,
    lastPreVisitTitle: lastPreVisit?.title || null,
    documentCount: docCount,
    messageCount,
    preVisitCount,
    profileAccessGranted: linkHasConsentScope(row, "profile"),
    hasPatientProvidedInfo: Boolean(row.consentAcceptedAt),
    openDataRequest: openDataRequest || null,
  };
}

const ACTIVITY_ACTION_MAP = {
  practice_document_shared: "document_shared",
  practice_document_share_revoked: "document_share_revoked",
  practice_document_archived: "document_archived",
  practice_document_deleted: "document_deleted",
  practice_thread_message_sent: "message_sent",
  patient_thread_message_sent: "message_sent",
  profile_access_granted: "profile_access_granted",
  profile_access_revoked: "profile_access_revoked",
  medication_plan_published: "medication_plan_published",
  practice_patient_link_status_updated: "relationship_status_changed",
  practice_patient_link_archived_by_patient: "relationship_archived",
  patient_data_request_submitted: "data_request_submitted",
  practice_thread_created: "thread_created",
};

const DOC_AUDIT_ACTION_MAP = {
  share_revoked: "document_share_revoked",
  archived: "document_archived",
  deleted: "document_deleted",
};

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function getPracticePatientActivity(linkId, practiceProfileId) {
  const row = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
  });
  if (!row) throw new Error("link_not_found");

  /** @type {{ id: string, type: string, occurredAt: Date, actorRole: string }[]} */
  const events = [];

  const [shares, messages, plans, dataRequests, audits, docAudits] =
    await Promise.all([
      prisma.practiceDocumentShare.findMany({
        where: { document: { practicePatientLinkId: linkId } },
        orderBy: { sharedAt: "desc" },
        take: 25,
        select: { id: true, sharedAt: true },
      }),
      prisma.practicePatientMessage.findMany({
        where: { thread: { practicePatientLinkId: linkId } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, createdAt: true, senderType: true },
      }),
      prisma.medicationPlan.findMany({
        where: {
          practicePatientLinkId: linkId,
          status: "published",
          publishedAt: { not: null },
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
        select: { id: true, publishedAt: true },
      }),
      prisma.patientDataRequest.findMany({
        where: { practicePatientLinkId: linkId },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, type: true, createdAt: true },
      }),
      prisma.auditLog.findMany({
        where: {
          entityType: "PracticePatientLink",
          entityId: linkId,
          action: {
            in: [
              "profile_access_granted",
              "profile_access_revoked",
              "practice_patient_link_status_updated",
              "practice_patient_link_archived_by_patient",
              "practice_patient_link_created",
              "practice_patient_link_consent_accepted",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, action: true, createdAt: true, actorRole: true },
      }),
      prisma.practiceDocumentAuditEntry.findMany({
        where: {
          practiceProfileId,
          patientUserId: row.patientUserId,
        },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, action: true, createdAt: true, actorRole: true },
      }),
    ]);

  for (const s of shares) {
    events.push({
      id: `share-${s.id}`,
      type: "document_shared",
      occurredAt: s.sharedAt,
      actorRole: "practice",
    });
  }

  for (const m of messages) {
    events.push({
      id: `msg-${m.id}`,
      type: "message_sent",
      occurredAt: m.createdAt,
      actorRole: m.senderType === "patient" ? "patient" : "practice",
    });
  }

  for (const p of plans) {
    if (!p.publishedAt) continue;
    events.push({
      id: `plan-${p.id}`,
      type: "medication_plan_published",
      occurredAt: p.publishedAt,
      actorRole: "practice",
    });
  }

  for (const r of dataRequests) {
    events.push({
      id: `req-${r.id}`,
      type: "data_request_submitted",
      occurredAt: r.createdAt,
      actorRole: "patient",
    });
  }

  for (const a of audits) {
    const type = ACTIVITY_ACTION_MAP[a.action];
    if (!type || type === "profile_viewed") continue;
    events.push({
      id: `audit-${a.id}`,
      type,
      occurredAt: a.createdAt,
      actorRole: a.actorRole === "patient" ? "patient" : "practice",
    });
  }

  for (const d of docAudits) {
    const type = DOC_AUDIT_ACTION_MAP[d.action];
    if (!type) continue;
    events.push({
      id: `doc-audit-${d.id}`,
      type,
      occurredAt: d.createdAt,
      actorRole: d.actorRole === "patient" ? "patient" : "practice",
    });
  }

  const planIds = (
    await prisma.medicationPlan.findMany({
      where: { practicePatientLinkId: linkId },
      select: { id: true },
    })
  ).map((x) => x.id);

  if (planIds.length > 0) {
    const medicationAudits = await prisma.auditLog.findMany({
      where: {
        action: "medication_plan_published",
        entityType: "MedicationPlan",
        entityId: { in: planIds },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, createdAt: true, actorRole: true },
    });

    for (const a of medicationAudits) {
      const type = ACTIVITY_ACTION_MAP[a.action];
      if (!type) continue;
      events.push({
        id: `audit-med-${a.id}`,
        type,
        occurredAt: a.createdAt,
        actorRole: "practice",
      });
    }
  }

  events.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

  const seen = new Set();
  const deduped = [];
  for (const e of events) {
    const key = `${e.type}-${e.occurredAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
    if (deduped.length >= 50) break;
  }

  return { events: deduped };
}

/**
 * @param {ReturnType<typeof import('./practicePatientLinkService.js').linkToJson>[]} links
 */
export async function enrichPracticePatientLinks(links) {
  if (!links.length) return links;

  const linkIds = links.map((l) => l.id);
  const practiceProfileId = links[0].practiceProfileId;
  const userIds = [...new Set(links.map((l) => l.patientUserId))];

  const [docCounts, threadAgg, docMax, threadMax, visitMax] = await Promise.all([
    prisma.practiceDocument.groupBy({
      by: ["practicePatientLinkId"],
      where: {
        practicePatientLinkId: { in: linkIds },
        status: "shared",
      },
      _count: { _all: true },
    }),
    prisma.practicePatientThread.findMany({
      where: { practicePatientLinkId: { in: linkIds } },
      select: {
        practicePatientLinkId: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
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
      where: {
        practiceProfileId,
        userId: { in: userIds },
      },
      _max: { updatedAt: true },
    }),
  ]);

  const docCountMap = Object.fromEntries(
    docCounts.map((r) => [r.practicePatientLinkId, r._count._all]),
  );
  const msgCountMap = {};
  for (const t of threadAgg) {
    const lid = t.practicePatientLinkId;
    msgCountMap[lid] = (msgCountMap[lid] || 0) + t._count.messages;
  }
  const docMaxMap = Object.fromEntries(
    docMax.map((r) => [r.practicePatientLinkId, r._max.updatedAt]),
  );
  const threadMaxMap = Object.fromEntries(
    threadMax.map((r) => [r.practicePatientLinkId, r._max.updatedAt]),
  );
  const visitMaxMap = Object.fromEntries(
    visitMax.map((r) => [r.userId, r._max.updatedAt]),
  );

  return links.map((link) => {
    let lastActivityAt = link.updatedAt;
    lastActivityAt = maxDate(lastActivityAt, docMaxMap[link.id]);
    lastActivityAt = maxDate(lastActivityAt, threadMaxMap[link.id]);
    lastActivityAt = maxDate(lastActivityAt, visitMaxMap[link.patientUserId]);

    return {
      ...link,
      profileAccessGranted: linkHasConsentScope(
        { consentScopes: link.consentScopes },
        "profile",
      ),
      summary: {
        documentCount: docCountMap[link.id] || 0,
        messageCount: msgCountMap[link.id] || 0,
        lastActivityAt,
        lastVisitAt: visitMaxMap[link.patientUserId] || null,
      },
    };
  });
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function listPreVisitsForPracticePatient(linkId, practiceProfileId) {
  const row = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
  });
  if (!row) throw new Error("link_not_found");

  const sessions = await prisma.preVisitSession.findMany({
    where: {
      practiceProfileId,
      userId: row.patientUserId,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      practiceStatus: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      openedAt: true,
    },
  });

  return { sessions };
}

/**
 * Full record payload for detail view.
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function getPracticePatientRecord(linkId, practiceProfileId) {
  const link = await getPracticePatientLink(linkId, practiceProfileId);
  const overview = await getPracticePatientOverview(linkId, practiceProfileId);
  return { link, overview };
}
