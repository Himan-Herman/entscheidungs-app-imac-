import { prisma } from "../../lib/prisma.js";
import { linkHasConsentScope } from "./consentScopes.js";
import { getPracticePatientLink } from "./practicePatientLinkService.js";
import { listPracticeLinkActivity } from "../activity/activityFeedService.js";


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

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {{ type?: string, q?: string, from?: string, to?: string }} [query]
 */
export async function getPracticePatientActivity(linkId, practiceProfileId, query = {}) {
  return listPracticeLinkActivity(linkId, practiceProfileId, query);
}

/**
 * @param {ReturnType<typeof import('./practicePatientLinkService.js').linkToJson>[]} links
 * @param {{ includeReminders?: boolean, includeInternalNotes?: boolean }} [visibility]
 *   What the CALLER is allowed to be told about. Both default to false: a
 *   counter is a statement that data exists, so a viewer without
 *   `reminders.read` must not learn from "2 open" that reminders are there at
 *   all. The caller passes its own permissions in; omitting them reveals
 *   nothing rather than everything.
 */
export async function enrichPracticePatientLinks(links, visibility = {}) {
  if (!links.length) return links;

  const linkIds = links.map((l) => l.id);
  const practiceProfileId = links[0].practiceProfileId;

  /*
   * The patient account id, fetched here rather than read off the link objects.
   *
   * WHY: `linkToJson` deliberately withholds `patientUserId` — a practice
   * addresses a relationship only through the practice-scoped link id, so the
   * global account id must never reach a practice response. This enrichment
   * still needs it internally, to look up pre-visit sessions, which are keyed
   * by user rather than by link. Reading it off the serialized object gave
   * `undefined`, and Prisma refused the query outright:
   *
   *   Invalid `prisma.preVisitSession.groupBy()` invocation:
   *     where: { userId: { in: [ undefined ] } }
   *
   * Fetching it here keeps both properties: the id is available where it is
   * needed, and it cannot escape — the map is local, never returned, never
   * attached to a link, never logged.
   */
  const linkOwners = await prisma.practicePatientLink.findMany({
    where: { id: { in: linkIds } },
    select: { id: true, patientUserId: true },
  });
  const patientIdByLink = new Map(linkOwners.map((r) => [r.id, r.patientUserId]));
  const userIds = [...new Set([...patientIdByLink.values()].filter(Boolean))];

  const [docCounts, threadAgg, docMax, threadMax, visitMax, medPlanLinks, openReqLinks, unreadAgg] =
    await Promise.all([
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
    prisma.medicationPlan.groupBy({
      by: ["practicePatientLinkId"],
      where: {
        practicePatientLinkId: { in: linkIds },
        status: "published",
      },
      _count: { _all: true },
    }),
    prisma.patientDataRequest.groupBy({
      by: ["practicePatientLinkId"],
      where: {
        practicePatientLinkId: { in: linkIds },
        status: { in: ["submitted", "in_review"] },
      },
      _count: { _all: true },
    }),
    prisma.practicePatientMessage.groupBy({
      by: ["threadId"],
      where: {
        senderType: "patient",
        readAt: null,
        thread: { practicePatientLinkId: { in: linkIds } },
      },
      _count: { _all: true },
    }),
  ]);

  /*
   * Phase 5B — two more grouped queries, never one per link. They run only when
   * the caller may see the underlying data class, so a forbidden counter costs
   * no query either.
   */
  const [openReminderAgg, internalNoteAgg] = await Promise.all([
    visibility.includeReminders
      ? prisma.practicePatientReminder.groupBy({
          by: ["practicePatientLinkId"],
          where: { practicePatientLinkId: { in: linkIds }, completedAt: null },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    visibility.includeInternalNotes
      ? prisma.practicePatientInternalNote.groupBy({
          by: ["practicePatientLinkId"],
          where: { practicePatientLinkId: { in: linkIds } },
          // Count and latest timestamp only. No bodies: this list is rendered
          // for a whole practice and note text has no business in it.
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  const openReminderMap = Object.fromEntries(
    openReminderAgg.map((r) => [r.practicePatientLinkId, r._count._all]),
  );
  const internalNoteMap = Object.fromEntries(
    internalNoteAgg.map((r) => [
      r.practicePatientLinkId,
      { count: r._count._all, lastAt: r._max.createdAt },
    ]),
  );

  const threadsByLink = await prisma.practicePatientThread.findMany({
    where: { practicePatientLinkId: { in: linkIds } },
    select: { id: true, practicePatientLinkId: true },
  });
  const threadLinkMap = Object.fromEntries(threadsByLink.map((t) => [t.id, t.practicePatientLinkId]));
  const unreadByLink = {};
  for (const row of unreadAgg) {
    const linkIdForThread = threadLinkMap[row.threadId];
    if (!linkIdForThread) continue;
    unreadByLink[linkIdForThread] =
      (unreadByLink[linkIdForThread] || 0) + row._count._all;
  }

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
  const medPlanMap = Object.fromEntries(
    medPlanLinks.map((r) => [r.practicePatientLinkId, r._count._all > 0]),
  );
  const openReqMap = Object.fromEntries(
    openReqLinks.map((r) => [r.practicePatientLinkId, r._count._all > 0]),
  );

  return links.map((link) => {
    let lastActivityAt = link.updatedAt;
    lastActivityAt = maxDate(lastActivityAt, docMaxMap[link.id]);
    lastActivityAt = maxDate(lastActivityAt, threadMaxMap[link.id]);
    lastActivityAt = maxDate(lastActivityAt, visitMaxMap[patientIdByLink.get(link.id)]);

    return {
      ...link,
      profileAccessGranted: linkHasConsentScope(
        { consentScopes: link.consentScopes },
        "profile",
      ),
      summary: {
        documentCount: docCountMap[link.id] || 0,
        messageCount: msgCountMap[link.id] || 0,
        unreadMessageCount: unreadByLink[link.id] || 0,
        hasUnreadMessages: (unreadByLink[link.id] || 0) > 0,
        hasDocuments: (docCountMap[link.id] || 0) > 0,
        hasPublishedMedicationPlan: Boolean(medPlanMap[link.id]),
        hasOpenDataRequest: Boolean(openReqMap[link.id]),
        lastActivityAt,
        lastVisitAt: visitMaxMap[patientIdByLink.get(link.id)] || null,
        /*
         * Phase 5B — present ONLY when the caller may read the data class.
         * The key is absent rather than zero: a zero would still tell a
         * forbidden reader that the feature applies to this relationship.
         */
        ...(visibility.includeReminders
          ? { openReminderCount: openReminderMap[link.id] || 0 }
          : {}),
        ...(visibility.includeInternalNotes
          ? {
              internalNoteCount: internalNoteMap[link.id]?.count || 0,
              lastInternalNoteAt: internalNoteMap[link.id]?.lastAt || null,
            }
          : {}),
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
