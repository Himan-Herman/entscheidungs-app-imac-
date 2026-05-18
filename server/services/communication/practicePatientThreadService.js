import { PrismaClient } from "@prisma/client";
import { requireConsentScopeAsync } from "../careRelationship/requireConsentScope.js";
import { notifyPatientInboxOfPracticeMessage } from "./inboxNotify.js";
import { notifyPracticeInboxOfPatientMessage } from "../practiceInbox/practiceInboxNotify.js";
import {
  PRACTICE_BRANDING_SELECT,
  practiceBrandingJson,
} from "../../utils/practiceBranding.js";

const prisma = new PrismaClient();

export const THREAD_STATUSES = new Set(["open", "closed", "archived"]);
export const SENDER_TYPES = new Set(["practice", "patient", "system"]);

const MAX_SUBJECT_LEN = 200;
const MAX_BODY_LEN = 8000;
const LINK_ACTIVE = new Set(["invited", "active"]);

const includeLinkPractice = {
  practiceProfile: { select: PRACTICE_BRANDING_SELECT },
};

function practiceFromProfile(profile) {
  if (!profile) return null;
  return practiceBrandingJson(profile);
}

/**
 * @param {import("@prisma/client").PracticePatientMessage} msg
 */
function messageToJson(msg) {
  return {
    id: msg.id,
    threadId: msg.threadId,
    senderType: msg.senderType,
    senderUserId: msg.senderUserId,
    body: msg.body,
    createdAt: msg.createdAt,
    readAt: msg.readAt,
  };
}

/**
 * @param {import("@prisma/client").PracticePatientThread & { messages?: import("@prisma/client").PracticePatientMessage[], _count?: { messages: number } }} row
 * @param {{ includeMessages?: boolean }} [opts]
 */
/**
 * @param {string} threadId
 * @param {"patient" | "practice"} unreadFromSender
 */
async function countUnreadFrom(threadId, unreadFromSender) {
  return prisma.practicePatientMessage.count({
    where: {
      threadId,
      senderType: unreadFromSender,
      readAt: null,
    },
  });
}

function threadToJson(row, opts = {}) {
  const lastMsg =
    row.messages && row.messages.length > 0
      ? row.messages[row.messages.length - 1]
      : null;
  return {
    id: row.id,
    practicePatientLinkId: row.practicePatientLinkId,
    practiceProfileId: row.practiceProfileId,
    patientUserId: row.patientUserId,
    subject: row.subject,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
    messageCount: row._count?.messages ?? (row.messages ? row.messages.length : undefined),
    unreadCount: opts.unreadCount ?? 0,
    hasUnread: (opts.unreadCount ?? 0) > 0,
    lastMessage: lastMsg ? messageToJson(lastMsg) : null,
    messages:
      opts.includeMessages && row.messages
        ? row.messages.map(messageToJson)
        : undefined,
  };
}

function trimText(text, max) {
  const v = String(text ?? "").trim();
  if (!v) return null;
  if (v.length > max) throw new Error("validation_text_too_long");
  return v;
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function assertLinkForPractice(linkId, practiceProfileId) {
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
    include: includeLinkPractice,
  });
  if (!link) throw new Error("link_not_found");
  if (!LINK_ACTIVE.has(link.status)) throw new Error("link_not_active");
  return link;
}

/**
 * @param {string} linkId
 * @param {string} patientUserId
 */
export async function assertLinkForPatient(linkId, patientUserId) {
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, patientUserId },
    include: includeLinkPractice,
  });
  if (!link) throw new Error("link_not_found");
  if (!LINK_ACTIVE.has(link.status)) throw new Error("link_not_active");
  return link;
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
async function getThreadForPractice(threadId, practiceProfileId, linkId) {
  const row = await prisma.practicePatientThread.findFirst({
    where: {
      id: threadId,
      practiceProfileId,
      practicePatientLinkId: linkId,
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      _count: { select: { messages: true } },
    },
  });
  if (!row) throw new Error("thread_not_found");
  return row;
}

/**
 * @param {string} threadId
 * @param {string} patientUserId
 */
async function getThreadForPatient(threadId, patientUserId) {
  const row = await prisma.practicePatientThread.findFirst({
    where: { id: threadId, patientUserId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      practiceProfile: { select: PRACTICE_BRANDING_SELECT },
      _count: { select: { messages: true } },
    },
  });
  if (!row) throw new Error("thread_not_found");
  return row;
}

/**
 * @param {{ linkId: string, practiceProfileId: string, subject?: string, body: string, senderUserId: string }} input
 */
export async function createThread(input) {
  const link = await assertLinkForPractice(input.linkId, input.practiceProfileId);
  await requireConsentScopeAsync(link, "messages", {
    actorUserId: input.senderUserId,
    actorRole: "practice",
  });
  const subject =
    input.subject != null ? trimText(input.subject, MAX_SUBJECT_LEN) : null;
  const body = trimText(input.body, MAX_BODY_LEN);
  if (!body) throw new Error("validation_required");

  const now = new Date();
  const thread = await prisma.practicePatientThread.create({
    data: {
      practicePatientLinkId: link.id,
      practiceProfileId: link.practiceProfileId,
      patientUserId: link.patientUserId,
      subject,
      status: "open",
      updatedAt: now,
      messages: {
        create: {
          senderType: "practice",
          senderUserId: input.senderUserId,
          body,
        },
      },
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      _count: { select: { messages: true } },
    },
  });

  await notifyPatientInboxOfPracticeMessage(thread);
  return threadToJson(thread, { includeMessages: true });
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function listThreadsForPractice(linkId, practiceProfileId, opts = {}) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const rows = await prisma.practicePatientThread.findMany({
    where: {
      practicePatientLinkId: linkId,
      practiceProfileId,
      ...(opts.includeArchived ? {} : { status: { not: "archived" } }),
    },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const out = [];
  for (const r of rows) {
    const unreadCount = await countUnreadFrom(r.id, "patient");
    const withLast = {
      ...r,
      messages: r.messages?.length ? [r.messages[0]] : [],
    };
    out.push(threadToJson(withLast, { unreadCount }));
  }
  return out;
}

/**
 * @param {string} patientUserId
 */
export async function listThreadsForPatient(patientUserId, opts = {}) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const rows = await prisma.practicePatientThread.findMany({
    where: {
      patientUserId: uid,
      ...(opts.includeArchived ? {} : { status: { not: "archived" } }),
    },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      practiceProfile: { select: PRACTICE_BRANDING_SELECT },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const out = [];
  for (const r of rows) {
    const unreadCount = await countUnreadFrom(r.id, "practice");
    const base = threadToJson(
      {
        ...r,
        messages: r.messages?.length ? [r.messages[0]] : [],
      },
      { unreadCount },
    );
    out.push({
      ...base,
      practice: r.practiceProfile
        ? practiceFromProfile(r.practiceProfile)
        : null,
    });
  }
  return out;
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
export async function getThread(threadId, practiceProfileId, linkId) {
  const row = await getThreadForPractice(threadId, practiceProfileId, linkId);
  return threadToJson(row, { includeMessages: true });
}

/**
 * @param {string} threadId
 * @param {string} patientUserId
 */
export async function getThreadForPatientUser(threadId, patientUserId) {
  const row = await getThreadForPatient(threadId, patientUserId);
  return {
    ...threadToJson(row, { includeMessages: true }),
    practice: row.practiceProfile
      ? practiceFromProfile(row.practiceProfile)
      : null,
  };
}

/**
 * @param {{ threadId: string, practiceProfileId: string, linkId: string, senderUserId: string, body: string }} input
 */
export async function addMessageFromPractice(input) {
  const thread = await getThreadForPractice(
    input.threadId,
    input.practiceProfileId,
    input.linkId,
  );
  if (thread.status === "archived") throw new Error("thread_archived");
  if (thread.status === "closed") throw new Error("thread_closed");

  const link = await assertLinkForPractice(input.linkId, input.practiceProfileId);
  await requireConsentScopeAsync(link, "messages", {
    actorUserId: input.senderUserId,
    actorRole: "practice",
  });

  const body = trimText(input.body, MAX_BODY_LEN);
  if (!body) throw new Error("validation_required");

  const now = new Date();
  await prisma.practicePatientMessage.create({
    data: {
      threadId: thread.id,
      senderType: "practice",
      senderUserId: input.senderUserId,
      body,
    },
  });

  const updated = await prisma.practicePatientThread.update({
    where: { id: thread.id },
    data: { updatedAt: now, status: "open" },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      _count: { select: { messages: true } },
    },
  });

  await notifyPatientInboxOfPracticeMessage(updated);
  return threadToJson(updated, { includeMessages: true });
}

/**
 * @param {{ threadId: string, patientUserId: string, body: string }} input
 */
export async function addMessageFromPatient(input) {
  const thread = await getThreadForPatient(input.threadId, input.patientUserId);
  if (thread.status === "archived") throw new Error("thread_archived");
  if (thread.status === "closed") throw new Error("thread_closed");

  const link = await prisma.practicePatientLink.findUnique({
    where: { id: thread.practicePatientLinkId },
  });
  if (!link) throw new Error("consent_required");
  await requireConsentScopeAsync(link, "messages", {
    actorUserId: input.patientUserId,
    actorRole: "patient",
  });

  const body = trimText(input.body, MAX_BODY_LEN);
  if (!body) throw new Error("validation_required");

  const now = new Date();
  await prisma.practicePatientMessage.create({
    data: {
      threadId: thread.id,
      senderType: "patient",
      senderUserId: input.patientUserId,
      body,
    },
  });

  const updated = await prisma.practicePatientThread.update({
    where: { id: thread.id },
    data: { updatedAt: now, status: "open" },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      _count: { select: { messages: true } },
    },
  });

  await notifyPracticeInboxOfPatientMessage(updated);

  return {
    ...threadToJson(updated, { includeMessages: true }),
    practice: thread.practiceProfile
      ? practiceFromProfile(thread.practiceProfile)
      : null,
  };
}

/**
 * Mark messages from the other party as read.
 * @param {string} threadId
 * @param {"practice" | "patient"} viewer
 * @param {{ practiceProfileId?: string, linkId?: string, patientUserId?: string }} scope
 */
export async function markThreadRead(threadId, viewer, scope) {
  let thread;
  if (viewer === "practice") {
    thread = await getThreadForPractice(
      threadId,
      scope.practiceProfileId,
      scope.linkId,
    );
  } else {
    thread = await getThreadForPatient(threadId, scope.patientUserId);
  }

  const otherSender = viewer === "practice" ? "patient" : "practice";
  const now = new Date();

  await prisma.practicePatientMessage.updateMany({
    where: {
      threadId: thread.id,
      senderType: otherSender,
      readAt: null,
    },
    data: { readAt: now },
  });

  if (viewer === "practice") {
    return getThread(threadId, scope.practiceProfileId, scope.linkId);
  }
  return getThreadForPatientUser(threadId, scope.patientUserId);
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
export async function closeThread(threadId, practiceProfileId, linkId) {
  const existing = await getThreadForPractice(threadId, practiceProfileId, linkId);
  if (existing.status === "archived") throw new Error("thread_archived");

  const now = new Date();
  const row = await prisma.practicePatientThread.update({
    where: { id: threadId },
    data: {
      status: "closed",
      closedAt: existing.closedAt || now,
      updatedAt: now,
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      _count: { select: { messages: true } },
    },
  });
  return threadToJson(row, { includeMessages: true });
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
export async function archiveThreadForPractice(threadId, practiceProfileId, linkId) {
  const existing = await getThreadForPractice(threadId, practiceProfileId, linkId);
  const now = new Date();
  const row = await prisma.practicePatientThread.update({
    where: { id: existing.id },
    data: { status: "archived", archivedAt: now, updatedAt: now },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      _count: { select: { messages: true } },
    },
  });
  return threadToJson(row, { includeMessages: true });
}

/**
 * @param {string} threadId
 * @param {string} practiceProfileId
 * @param {string} linkId
 */
export async function restoreThreadForPractice(threadId, practiceProfileId, linkId) {
  const existing = await getThreadForPractice(threadId, practiceProfileId, linkId);
  if (existing.status !== "archived") throw new Error("thread_not_archived");
  const now = new Date();
  const row = await prisma.practicePatientThread.update({
    where: { id: existing.id },
    data: {
      status: existing.closedAt ? "closed" : "open",
      archivedAt: null,
      updatedAt: now,
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      _count: { select: { messages: true } },
    },
  });
  return threadToJson(row, { includeMessages: true });
}

/**
 * @param {string} threadId
 * @param {string} patientUserId
 */
export async function archiveThreadForPatient(threadId, patientUserId) {
  const existing = await getThreadForPatient(threadId, patientUserId);
  const now = new Date();
  const row = await prisma.practicePatientThread.update({
    where: { id: existing.id },
    data: { status: "archived", archivedAt: now, updatedAt: now },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      practiceProfile: { select: PRACTICE_BRANDING_SELECT },
      _count: { select: { messages: true } },
    },
  });
  return {
    ...threadToJson(row, { includeMessages: true }),
    practice: row.practiceProfile
      ? practiceFromProfile(row.practiceProfile)
      : null,
  };
}

/**
 * @param {string} threadId
 * @param {string} patientUserId
 */
export async function restoreThreadForPatient(threadId, patientUserId) {
  const existing = await getThreadForPatient(threadId, patientUserId);
  if (existing.status !== "archived") throw new Error("thread_not_archived");
  const now = new Date();
  const row = await prisma.practicePatientThread.update({
    where: { id: existing.id },
    data: {
      status: existing.closedAt ? "closed" : "open",
      archivedAt: null,
      updatedAt: now,
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      practiceProfile: { select: PRACTICE_BRANDING_SELECT },
      _count: { select: { messages: true } },
    },
  });
  return {
    ...threadToJson(row, { includeMessages: true }),
    practice: row.practiceProfile
      ? practiceFromProfile(row.practiceProfile)
      : null,
  };
}
