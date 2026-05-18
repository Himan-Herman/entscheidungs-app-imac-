import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import { patientInboxTitleForType } from "../../constants/inboxNotificationCatalog.js";
import {
  PRACTICE_BRANDING_SELECT,
  practiceBrandingJson,
} from "../../utils/practiceBranding.js";

const prisma = new PrismaClient();

export const INBOX_TYPES = new Set([
  "medication",
  "message",
  "document",
  "profile",
  "data_request",
  "system",
]);
export const INBOX_STATUSES = new Set(["unread", "read", "archived"]);

/** Default neutral title — callers should prefer this over clinical wording. */
export const NEUTRAL_INBOX_TITLE = "Neue Information von Ihrer Praxis";

const MAX_TITLE_LEN = 200;
const MAX_SUMMARY_LEN = 500;
const MAX_SOURCE_LABEL_LEN = 120;
const MAX_TARGET_URL_LEN = 2048;

const includePractice = {
  practiceProfile: {
    select: PRACTICE_BRANDING_SELECT,
  },
};

/**
 * @param {import("@prisma/client").PatientInboxItem & { practiceProfile?: { id: string, practiceName: string } | null }} row
 */
export function inboxItemToJson(row) {
  return {
    id: row.id,
    patientUserId: row.patientUserId,
    practiceProfileId: row.practiceProfileId,
    practicePatientLinkId: row.practicePatientLinkId,
    type: row.type,
    title: row.title,
    titleKey: row.titleKey,
    summary: row.summary,
    summaryKey: row.summaryKey,
    status: row.status,
    sourceLabel: row.sourceLabel,
    targetUrl: row.targetUrl,
    createdAt: row.createdAt,
    readAt: row.readAt,
    archivedAt: row.archivedAt,
    practice: row.practiceProfile ? practiceBrandingJson(row.practiceProfile) : null,
  };
}

/**
 * @param {string | null | undefined} text
 * @param {number} max
 */
function trimText(text, max) {
  const v = String(text ?? "").trim();
  if (!v) return null;
  if (v.length > max) throw new Error("validation_text_too_long");
  return v;
}

/**
 * @param {{ patientUserId: string, practiceProfileId?: string | null, practicePatientLinkId?: string | null, type: string, title?: string, summary?: string | null, sourceLabel?: string | null, targetUrl?: string | null }} input
 */
export async function createInboxItem(input) {
  const patientUserId = String(input.patientUserId || "").trim();
  if (!patientUserId) throw new Error("validation_required");

  const type = String(input.type || "").trim();
  if (!INBOX_TYPES.has(type)) throw new Error("validation_invalid_type");

  const titleKey = input.titleKey ? trimText(input.titleKey, 80) : null;
  const title = trimText(
    input.title || patientInboxTitleForType(type, null) || NEUTRAL_INBOX_TITLE,
    MAX_TITLE_LEN,
  );
  if (!title) throw new Error("validation_required");
  const summaryKey = input.summaryKey ? trimText(input.summaryKey, 80) : null;

  const summary = input.summary != null ? trimText(input.summary, MAX_SUMMARY_LEN) : null;
  const sourceLabel =
    input.sourceLabel != null ? trimText(input.sourceLabel, MAX_SOURCE_LABEL_LEN) : null;
  const targetUrl =
    input.targetUrl != null ? trimText(input.targetUrl, MAX_TARGET_URL_LEN) : null;

  let practiceProfileId = null;
  if (input.practiceProfileId != null && String(input.practiceProfileId).trim()) {
    practiceProfileId = String(input.practiceProfileId).trim();
    const practice = await prisma.practiceProfile.findUnique({
      where: { id: practiceProfileId },
    });
    if (!practice) throw new Error("practice_not_found");
  }

  let practicePatientLinkId = null;
  if (input.practicePatientLinkId != null && String(input.practicePatientLinkId).trim()) {
    practicePatientLinkId = String(input.practicePatientLinkId).trim();
    const link = await prisma.practicePatientLink.findFirst({
      where: { id: practicePatientLinkId, patientUserId },
    });
    if (!link) throw new Error("link_not_found");
    if (!practiceProfileId) practiceProfileId = link.practiceProfileId;
  }

  const user = await prisma.user.findUnique({ where: { id: patientUserId } });
  if (!user) throw new Error("patient_user_not_found");

  const row = await prisma.patientInboxItem.create({
    data: {
      patientUserId,
      practiceProfileId,
      practicePatientLinkId,
      type,
      title,
      titleKey,
      summary,
      summaryKey,
      sourceLabel,
      targetUrl,
      status: "unread",
    },
    include: includePractice,
  });

  writeAuditLog({
    userId: patientUserId,
    actorRole: "system",
    action: "patient_inbox_item_created",
    entityType: "inbox_item",
    entityId: row.id,
    practiceProfileId,
    patientUserId,
    practicePatientLinkId,
    metadata: { type, titleKey },
  });

  return inboxItemToJson(row);
}

/**
 * @param {string} patientUserId
 */
export async function countUnreadPatientInbox(patientUserId) {
  const uid = String(patientUserId || "").trim();
  if (!uid) return 0;
  return prisma.patientInboxItem.count({
    where: { patientUserId: uid, status: "unread" },
  });
}

/**
 * @param {string} patientUserId
 * @param {{ status?: string, type?: string, limit?: number, offset?: number }} [opts]
 */
export async function listInboxItemsForPatient(patientUserId, opts = {}) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const statusFilter =
    opts.status && INBOX_STATUSES.has(opts.status) ? opts.status : undefined;
  const typeFilter =
    opts.type && INBOX_TYPES.has(opts.type) ? opts.type : undefined;

  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);

  const where = {
    patientUserId: uid,
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : { status: { not: "archived" } }),
  };

  const [rows, total] = await Promise.all([
    prisma.patientInboxItem.findMany({
      where,
      include: includePractice,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.patientInboxItem.count({ where }),
  ]);

  return {
    items: rows.map(inboxItemToJson),
    total,
    limit,
    offset,
  };
}

/**
 * @param {string} itemId
 * @param {string} patientUserId
 */
export async function markInboxItemRead(itemId, patientUserId) {
  const id = String(itemId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const existing = await prisma.patientInboxItem.findFirst({
    where: { id, patientUserId: uid },
  });
  if (!existing) throw new Error("item_not_found");
  if (existing.status === "archived") throw new Error("item_archived");

  const now = new Date();
  const row = await prisma.patientInboxItem.update({
    where: { id },
    data: {
      status: "read",
      readAt: existing.readAt || now,
    },
    include: includePractice,
  });

  return inboxItemToJson(row);
}

/**
 * @param {string} itemId
 * @param {string} patientUserId
 */
export async function archiveInboxItem(itemId, patientUserId) {
  const id = String(itemId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const existing = await prisma.patientInboxItem.findFirst({
    where: { id, patientUserId: uid },
  });
  if (!existing) throw new Error("item_not_found");

  const now = new Date();
  const row = await prisma.patientInboxItem.update({
    where: { id },
    data: {
      status: "archived",
      archivedAt: existing.archivedAt || now,
      readAt: existing.readAt || now,
    },
    include: includePractice,
  });

  return inboxItemToJson(row);
}

/**
 * @param {string} itemId
 * @param {string} patientUserId
 */
export async function restoreInboxItem(itemId, patientUserId) {
  const id = String(itemId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const existing = await prisma.patientInboxItem.findFirst({
    where: { id, patientUserId: uid },
  });
  if (!existing) throw new Error("item_not_found");
  if (existing.status !== "archived") throw new Error("item_not_archived");

  const row = await prisma.patientInboxItem.update({
    where: { id },
    data: {
      status: existing.readAt ? "read" : "unread",
      archivedAt: null,
    },
    include: includePractice,
  });

  return inboxItemToJson(row);
}
