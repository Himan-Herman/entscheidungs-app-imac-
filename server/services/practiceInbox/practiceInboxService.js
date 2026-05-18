import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const INBOX_TYPES = new Set([
  "message",
  "previsit",
  "follow_up",
  "document",
  "medication",
  "profile",
  "data_request",
  "system",
]);

export const INBOX_STATUSES = new Set(["new", "read", "done", "archived"]);
export const INBOX_PRIORITIES = new Set(["normal", "important"]);

const MAX_TITLE_LEN = 200;
const MAX_SUMMARY_LEN = 500;
const MAX_TARGET_URL_LEN = 2048;

const includeRelations = {
  patientUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  practicePatientLink: {
    select: {
      id: true,
      status: true,
      assignmentStatus: true,
      assignedDoctorUserId: true,
      assignedTeamMemberUserId: true,
      patientProfile: { select: { id: true, displayName: true } },
    },
  },
};

/**
 * @param {import("@prisma/client").PracticeInboxItem & { patientUser?: object, practicePatientLink?: object }} row
 */
export function practiceInboxItemToJson(row) {
  const user = row.patientUser;
  const link = row.practicePatientLink;
  const displayName =
    link?.patientProfile?.displayName?.trim() ||
    (user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : null);

  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    practicePatientLinkId: row.practicePatientLinkId,
    patientUserId: row.patientUserId,
    type: row.type,
    title: row.title,
    titleKey: row.titleKey,
    summary: row.summary,
    summaryKey: row.summaryKey,
    status: row.status,
    priority: row.priority,
    sourceRefType: row.sourceRefType,
    sourceRefId: row.sourceRefId,
    targetUrl: row.targetUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastActivityAt: row.lastActivityAt,
    readAt: row.readAt,
    doneAt: row.doneAt,
    archivedAt: row.archivedAt,
    patient: user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          displayName: displayName || null,
        }
      : null,
    link: link
      ? {
          id: link.id,
          status: link.status,
        }
      : null,
  };
}

function trimText(text, max) {
  const v = String(text ?? "").trim();
  if (!v) return null;
  if (v.length > max) return v.slice(0, max);
  return v;
}

/**
 * Create or bump an open inbox row for the same source reference.
 * @param {object} input
 */
export async function upsertPracticeInboxItem(input) {
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  if (!practiceProfileId) throw new Error("validation_required");

  const type = String(input.type || "").trim();
  if (!INBOX_TYPES.has(type)) throw new Error("validation_invalid_type");

  const title = trimText(input.title, MAX_TITLE_LEN);
  if (!title) throw new Error("validation_required");

  const priority =
    input.priority && INBOX_PRIORITIES.has(input.priority) ? input.priority : "normal";

  const now = new Date();
  const data = {
    practiceProfileId,
    practicePatientLinkId: input.practicePatientLinkId || null,
    patientUserId: input.patientUserId || null,
    type,
    title,
    titleKey: input.titleKey ? trimText(input.titleKey, 80) : null,
    summary: input.summary != null ? trimText(input.summary, MAX_SUMMARY_LEN) : null,
    summaryKey: input.summaryKey ? trimText(input.summaryKey, 80) : null,
    priority,
    sourceRefType: input.sourceRefType || null,
    sourceRefId: input.sourceRefId || null,
    targetUrl: input.targetUrl != null ? trimText(input.targetUrl, MAX_TARGET_URL_LEN) : null,
    lastActivityAt: now,
    updatedAt: now,
  };

  if (data.sourceRefType && data.sourceRefId) {
    const existing = await prisma.practiceInboxItem.findFirst({
      where: {
        practiceProfileId,
        sourceRefType: data.sourceRefType,
        sourceRefId: data.sourceRefId,
        status: { not: "archived" },
      },
    });
    if (existing) {
      const row = await prisma.practiceInboxItem.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          summary: data.summary ?? existing.summary,
          lastActivityAt: now,
          updatedAt: now,
          status: existing.status === "archived" ? "archived" : "new",
          priority: data.priority,
          targetUrl: data.targetUrl ?? existing.targetUrl,
        },
        include: includeRelations,
      });
      return practiceInboxItemToJson(row);
    }
  }

  const row = await prisma.practiceInboxItem.create({
    data: { ...data, status: "new" },
    include: includeRelations,
  });

  writeAuditLog({
    actorRole: "system",
    action: "practice_inbox_item_created",
    entityType: "inbox_item",
    entityId: row.id,
    practiceProfileId: pid,
    patientUserId: row.patientUserId,
    practicePatientLinkId: row.practicePatientLinkId,
    metadata: { type: row.type, titleKey: row.titleKey },
  });

  return practiceInboxItemToJson(row);
}

/**
 * @param {string} practiceProfileId
 */
export async function countNewPracticeInbox(practiceProfileId) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) return 0;
  return prisma.practiceInboxItem.count({
    where: { practiceProfileId: pid, status: "new" },
  });
}

/**
 * @param {string} practiceProfileId
 * @param {{ status?: string, type?: string, q?: string, sort?: string, limit?: number, offset?: number }} opts
 */
export async function listPracticeInboxItems(practiceProfileId, opts = {}) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("practiceId_required");

  const statusFilter =
    opts.status && INBOX_STATUSES.has(opts.status) ? opts.status : undefined;
  const typeFilter = opts.type && INBOX_TYPES.has(opts.type) ? opts.type : undefined;
  const assignmentFilter = String(opts.assignmentFilter || "").trim();
  const actorUserId = String(opts.actorUserId || "").trim();

  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);

  /** @type {import("@prisma/client").Prisma.PracticeInboxItemWhereInput} */
  let where = { practiceProfileId: pid };

  if (statusFilter) {
    where.status = statusFilter;
  } else if (opts.workflowStatus === "forwarded") {
    where.practicePatientLink = { assignmentStatus: "forwarded" };
    where.status = { not: "archived" };
  } else if (opts.workflowStatus === "in_progress") {
    where.status = "read";
  } else {
    where.status = { not: "archived" };
  }

  if (typeFilter) {
    where.type = typeFilter;
  }

  if (assignmentFilter === "assigned_to_me" && actorUserId) {
    where.practicePatientLink = {
      ...(typeof where.practicePatientLink === "object" ? where.practicePatientLink : {}),
      OR: [
        { assignedDoctorUserId: actorUserId },
        { assignedTeamMemberUserId: actorUserId },
      ],
    };
  } else if (assignmentFilter === "unassigned") {
    where.practicePatientLink = {
      ...(typeof where.practicePatientLink === "object" ? where.practicePatientLink : {}),
      assignmentStatus: { in: ["unassigned", "forwarded"] },
      assignedDoctorUserId: null,
    };
  } else if (assignmentFilter === "doctors") {
    where.practicePatientLink = {
      ...(typeof where.practicePatientLink === "object" ? where.practicePatientLink : {}),
      assignedDoctorUserId: { not: null },
    };
  } else if (assignmentFilter === "secretary") {
    where.practicePatientLink = {
      ...(typeof where.practicePatientLink === "object" ? where.practicePatientLink : {}),
      assignedTeamMemberUserId: { not: null },
    };
  }

  const q = String(opts.q || "").trim().toLowerCase();
  if (q) {
    where = {
      AND: [
        where,
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            {
              patientUser: {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  const sort = String(opts.sort || "activity");
  const orderBy =
    sort === "status"
      ? [{ status: "asc" }, { lastActivityAt: "desc" }]
      : sort === "created"
        ? [{ createdAt: "desc" }]
        : [{ lastActivityAt: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.practiceInboxItem.findMany({
      where,
      include: includeRelations,
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.practiceInboxItem.count({ where }),
  ]);

  return {
    items: rows.map(practiceInboxItemToJson),
    total,
    limit,
    offset,
  };
}

/**
 * @param {string} itemId
 * @param {string} practiceProfileId
 */
export async function getPracticeInboxItem(itemId, practiceProfileId) {
  const id = String(itemId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  if (!id || !pid) throw new Error("validation_required");

  const row = await prisma.practiceInboxItem.findFirst({
    where: { id, practiceProfileId: pid },
    include: includeRelations,
  });
  if (!row) throw new Error("item_not_found");

  const item = practiceInboxItemToJson(row);
  /** @type {Record<string, unknown>} */
  const context = { kind: row.type };

  if (row.type === "message" && row.sourceRefId) {
    const thread = await prisma.practicePatientThread.findFirst({
      where: { id: row.sourceRefId, practiceProfileId: pid },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 20 },
      },
    });
    if (thread) {
      context.thread = {
        id: thread.id,
        subject: thread.subject,
        status: thread.status,
        messages: thread.messages.map((m) => ({
          id: m.id,
          senderType: m.senderType,
          createdAt: m.createdAt,
          body: m.body,
        })),
      };
    }
  }

  if (row.type === "follow_up" && row.sourceRefId) {
    const thread = await prisma.preVisitFollowUpThread.findFirst({
      where: { id: row.sourceRefId, practiceProfileId: pid },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 20 },
        session: { select: { id: true, title: true } },
      },
    });
    if (thread) {
      context.followUp = {
        id: thread.id,
        title: thread.title,
        status: thread.status,
        sessionTitle: thread.session?.title,
        messages: thread.messages.map((m) => ({
          id: m.id,
          senderType: m.senderType,
          createdAt: m.createdAt,
          body: m.body,
        })),
      };
    }
  }

  if (row.type === "data_request" && row.sourceRefId) {
    const req = await prisma.patientDataRequest.findFirst({
      where: { id: row.sourceRefId, practiceProfileId: pid },
      select: { id: true, type: true, status: true, reason: true, createdAt: true },
    });
    if (req) context.dataRequest = req;
  }

  return { item, context };
}

async function updateItemStatus(itemId, practiceProfileId, status, extra = {}) {
  const existing = await prisma.practiceInboxItem.findFirst({
    where: { id: itemId, practiceProfileId },
  });
  if (!existing) throw new Error("item_not_found");

  const now = new Date();
  const row = await prisma.practiceInboxItem.update({
    where: { id: itemId },
    data: {
      status,
      updatedAt: now,
      ...extra,
    },
    include: includeRelations,
  });
  return practiceInboxItemToJson(row);
}

export async function markPracticeInboxRead(itemId, practiceProfileId) {
  const existing = await prisma.practiceInboxItem.findFirst({
    where: { id: itemId, practiceProfileId },
  });
  if (!existing) throw new Error("item_not_found");
  if (existing.status === "archived") throw new Error("item_archived");

  const now = new Date();
  return updateItemStatus(itemId, practiceProfileId, existing.status === "new" ? "read" : existing.status, {
    readAt: existing.readAt || now,
  });
}

export async function markPracticeInboxDone(itemId, practiceProfileId) {
  const existing = await prisma.practiceInboxItem.findFirst({
    where: { id: itemId, practiceProfileId },
  });
  if (!existing) throw new Error("item_not_found");
  if (existing.status === "archived") throw new Error("item_archived");

  const now = new Date();
  return updateItemStatus(itemId, practiceProfileId, "done", {
    doneAt: existing.doneAt || now,
    readAt: existing.readAt || now,
  });
}

export async function archivePracticeInboxItem(itemId, practiceProfileId) {
  const existing = await prisma.practiceInboxItem.findFirst({
    where: { id: itemId, practiceProfileId },
  });
  if (!existing) throw new Error("item_not_found");

  const now = new Date();
  return updateItemStatus(itemId, practiceProfileId, "archived", {
    archivedAt: existing.archivedAt || now,
    readAt: existing.readAt || now,
  });
}

export async function restorePracticeInboxItem(itemId, practiceProfileId) {
  const existing = await prisma.practiceInboxItem.findFirst({
    where: { id: itemId, practiceProfileId },
  });
  if (!existing) throw new Error("item_not_found");
  if (existing.status !== "archived") throw new Error("item_not_archived");

  const prior =
    existing.doneAt ? "done" : existing.readAt ? "read" : existing.status === "new" ? "new" : "read";

  return updateItemStatus(itemId, practiceProfileId, prior, {
    archivedAt: null,
  });
}
