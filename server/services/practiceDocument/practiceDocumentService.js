import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { practiceResourceStatusWhere } from "../../utils/lifecycleStatus.js";
import { getPracticeDocumentStorage } from "./storage/index.js";
import { notifyPatientInboxOfPracticeDocument } from "./inboxNotify.js";
import { writePracticeDocumentAudit } from "./practiceDocumentAuditService.js";
import {
  PRACTICE_BRANDING_SELECT,
  practiceBrandingJson,
} from "../../utils/practiceBranding.js";

const storage = getPracticeDocumentStorage();

export const DOCUMENT_TYPES = new Set([
  "report",
  "lab",
  "imaging",
  "referral",
  "discharge",
  "prescription_info",
  "other",
]);
export const DOCUMENT_STATUSES = new Set(["draft", "shared", "archived", "deleted"]);
export const SHARE_STATUSES = new Set(["active", "revoked"]);

const LINK_ACTIVE = new Set(["invited", "active"]);
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_FILES_PER_DOCUMENT = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const docInclude = {
  files: { orderBy: { createdAt: "asc" } },
  shares: { orderBy: { sharedAt: "desc" } },
  practiceProfile: { select: PRACTICE_BRANDING_SELECT },
};

function trimText(text, max) {
  const v = String(text ?? "").trim();
  if (!v) return null;
  if (v.length > max) throw new Error("validation_text_too_long");
  return v;
}

function normalizeType(type) {
  const t = String(type || "other").trim();
  if (!DOCUMENT_TYPES.has(t)) throw new Error("validation_invalid_type");
  return t;
}

function isShareExpired(share) {
  if (!share?.expiresAt) return false;
  return new Date(share.expiresAt).getTime() <= Date.now();
}

/**
 * @param {import("@prisma/client").PracticeDocument & { files?: import("@prisma/client").PracticeDocumentFile[], shares?: import("@prisma/client").PracticeDocumentShare[], practiceProfile?: { practiceName: string | null } }} row
 */
function documentToJson(row) {
  const activeShare =
    row.shares?.find((s) => s.status === "active" && !isShareExpired(s)) ?? null;
  return {
    id: row.id,
    practicePatientLinkId: row.practicePatientLinkId,
    practiceProfileId: row.practiceProfileId,
    patientUserId: row.patientUserId,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status,
    createdByUserId: row.createdByUserId,
    sharedAt: row.sharedAt,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    practiceName: row.practiceProfile?.practiceName ?? null,
    practice: row.practiceProfile ? practiceBrandingJson(row.practiceProfile) : null,
    shareStatus: activeShare?.status ?? null,
    files: (row.files || []).map((f) => ({
      id: f.id,
      originalFileName: f.originalFileName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      createdAt: f.createdAt,
    })),
  };
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function assertLinkForPractice(linkId, practiceProfileId, ctx = {}) {
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
  });
  if (!link) throw new Error("link_not_found");
  if (!LINK_ACTIVE.has(link.status)) throw new Error("link_not_active");
  const { assertConsentForLink } = await import("../consent/consentRecordService.js");
  await assertConsentForLink(link, "document_sharing", ctx);
  return link;
}

async function loadDocumentForPractice(documentId, linkId, practiceProfileId) {
  const doc = await prisma.practiceDocument.findFirst({
    where: {
      id: documentId,
      practicePatientLinkId: linkId,
      practiceProfileId,
    },
    include: docInclude,
  });
  if (!doc) throw new Error("document_not_found");
  if (doc.status === "deleted") throw new Error("document_unavailable");
  return doc;
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} createdByUserId
 * @param {{ type?: string, title?: string, description?: string }} payload
 */
export async function createPracticeDocumentDraft(
  linkId,
  practiceProfileId,
  createdByUserId,
  payload,
) {
  const link = await assertLinkForPractice(linkId, practiceProfileId);
  const title = trimText(payload.title, MAX_TITLE);
  if (!title) throw new Error("validation_required");
  const type = normalizeType(payload.type);
  const description = trimText(payload.description, MAX_DESCRIPTION);

  const doc = await prisma.practiceDocument.create({
    data: {
      practicePatientLinkId: link.id,
      practiceProfileId: link.practiceProfileId,
      patientUserId: link.patientUserId,
      type,
      title,
      description,
      status: "draft",
      createdByUserId,
    },
    include: docInclude,
  });

  return documentToJson(doc);
}

/**
 * @param {string} documentId
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {{ type?: string, title?: string, description?: string }} payload
 */
export async function updatePracticeDocumentDraft(
  documentId,
  linkId,
  practiceProfileId,
  payload,
) {
  const existing = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  if (existing.status === "deleted") throw new Error("document_deleted");
  if (existing.status !== "draft") throw new Error("document_not_editable");

  const data = {};
  if (payload.title !== undefined) {
    const title = trimText(payload.title, MAX_TITLE);
    if (!title) throw new Error("validation_required");
    data.title = title;
  }
  if (payload.type !== undefined) data.type = normalizeType(payload.type);
  if (payload.description !== undefined) {
    data.description = trimText(payload.description, MAX_DESCRIPTION);
  }

  const doc = await prisma.practiceDocument.update({
    where: { id: documentId },
    data,
    include: docInclude,
  });

  return documentToJson(doc);
}

/**
 * @param {string} documentId
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {{ buffer: Buffer, originalFileName: string, mimeType: string }} file
 */
export async function uploadPracticeDocumentFile(
  documentId,
  linkId,
  practiceProfileId,
  file,
) {
  const doc = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  if (doc.status === "deleted") throw new Error("document_deleted");
  if (doc.status !== "draft") throw new Error("document_not_editable");

  const mimeType = String(file.mimeType || "").toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) throw new Error("validation_invalid_file_type");
  if (!file.buffer?.length) throw new Error("validation_required");
  if (file.buffer.length > MAX_FILE_BYTES) throw new Error("validation_file_too_large");

  const count = await prisma.practiceDocumentFile.count({ where: { documentId } });
  if (count >= MAX_FILES_PER_DOCUMENT) throw new Error("validation_too_many_files");

  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const storageKey = await storage.putObject({
    practiceProfileId,
    documentId,
    buffer: file.buffer,
    originalFileName: file.originalFileName,
  });

  await prisma.practiceDocumentFile.create({
    data: {
      documentId,
      storageKey,
      originalFileName: String(file.originalFileName || "file").slice(0, 200),
      mimeType,
      sizeBytes: file.buffer.length,
      checksum,
    },
  });

  const updated = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  return documentToJson(updated);
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function listDocumentsForPracticePatient(
  linkId,
  practiceProfileId,
  opts = {},
) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const rows = await prisma.practiceDocument.findMany({
    where: {
      practicePatientLinkId: linkId,
      practiceProfileId,
      ...practiceResourceStatusWhere({ includeArchived: opts.includeArchived }),
    },
    include: docInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => documentToJson(r));
}

/**
 * @param {string} documentId
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function getDocumentForPractice(documentId, linkId, practiceProfileId) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const doc = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  return documentToJson(doc);
}

/**
 * @param {string} documentId
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} sharedByUserId
 */
export async function shareDocumentWithPatient(
  documentId,
  linkId,
  practiceProfileId,
  sharedByUserId,
) {
  const doc = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  if (doc.status === "deleted") throw new Error("document_deleted");
  if (doc.status === "archived") throw new Error("document_archived");
  if (!doc.files.length) throw new Error("validation_required");

  const now = new Date();

  await prisma.practiceDocumentShare.updateMany({
    where: { documentId, status: "active" },
    data: { status: "revoked", revokedAt: now },
  });

  await prisma.practiceDocumentShare.create({
    data: {
      documentId,
      patientUserId: doc.patientUserId,
      sharedByUserId,
      status: "active",
      sharedAt: now,
    },
  });

  const updated = await prisma.practiceDocument.update({
    where: { id: documentId },
    data: { status: "shared", sharedAt: now },
    include: docInclude,
  });

  const json = documentToJson(updated);
  await notifyPatientInboxOfPracticeDocument({
    id: updated.id,
    patientUserId: updated.patientUserId,
    practiceProfileId: updated.practiceProfileId,
    practicePatientLinkId: updated.practicePatientLinkId,
  });

  import("../practiceDeveloper/emitDeveloperEvents.js")
    .then((m) => m.emitDocumentShared(updated))
    .catch(() => {});

  return json;
}

/**
 * @param {string} documentId
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function revokeDocumentShare(
  documentId,
  linkId,
  practiceProfileId,
  actorUserId,
) {
  const doc = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  if (doc.status === "deleted") throw new Error("document_deleted");
  if (doc.status !== "shared") throw new Error("document_not_shared");

  const now = new Date();
  const revoked = await prisma.practiceDocumentShare.updateMany({
    where: { documentId, status: "active" },
    data: { status: "revoked", revokedAt: now },
  });

  if (revoked.count > 0) {
    await writePracticeDocumentAudit({
      actorUserId,
      actorRole: "practice",
      practiceProfileId: doc.practiceProfileId,
      patientUserId: doc.patientUserId,
      resourceType: "practice_document",
      resourceId: doc.id,
      action: "share_revoked",
      metadata: {
        documentType: doc.type,
        fileCount: doc.files.length,
        previousStatus: doc.status,
      },
    });
  }

  const updated = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  return documentToJson(updated);
}

/**
 * @param {string} documentId
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} actorUserId
 */
export async function archiveDocument(
  documentId,
  linkId,
  practiceProfileId,
  actorUserId,
) {
  const doc = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  if (doc.status === "deleted") throw new Error("document_deleted");
  if (doc.status === "archived") throw new Error("document_already_archived");

  const now = new Date();
  await prisma.practiceDocumentShare.updateMany({
    where: { documentId, status: "active" },
    data: { status: "revoked", revokedAt: now },
  });

  const updated = await prisma.practiceDocument.update({
    where: { id: documentId },
    data: { status: "archived", archivedAt: now },
    include: docInclude,
  });

  await writePracticeDocumentAudit({
    actorUserId,
    actorRole: "practice",
    practiceProfileId: doc.practiceProfileId,
    patientUserId: doc.patientUserId,
    resourceType: "practice_document",
    resourceId: doc.id,
    action: "archived",
    metadata: {
      documentType: doc.type,
      fileCount: doc.files.length,
      previousStatus: doc.status,
    },
  });

  return documentToJson(updated);
}

/**
 * Restore archived document to previous active state (shared if was shared, else draft).
 */
export async function restoreArchivedDocument(
  documentId,
  linkId,
  practiceProfileId,
  actorUserId,
) {
  const doc = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  if (doc.status !== "archived") throw new Error("document_not_archived");

  const nextStatus = doc.sharedAt ? "shared" : "draft";
  const updated = await prisma.practiceDocument.update({
    where: { id: documentId },
    data: {
      status: nextStatus,
      archivedAt: null,
    },
    include: docInclude,
  });

  await writePracticeDocumentAudit({
    actorUserId,
    actorRole: "practice",
    practiceProfileId: doc.practiceProfileId,
    patientUserId: doc.patientUserId,
    resourceType: "practice_document",
    resourceId: doc.id,
    action: "restored",
    metadata: {
      documentType: doc.type,
      restoredToStatus: nextStatus,
    },
  });

  return documentToJson(updated);
}

/**
 * Soft-delete: status deleted, revoke shares, keep DB rows + storage for retention.
 * @param {string} documentId
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} actorUserId
 * @param {string} [reason]
 */
export async function softDeletePracticeDocument(
  documentId,
  linkId,
  practiceProfileId,
  actorUserId,
  reason,
) {
  const doc = await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  if (doc.status === "deleted") throw new Error("document_already_deleted");

  const now = new Date();
  await prisma.practiceDocumentShare.updateMany({
    where: { documentId, status: "active" },
    data: { status: "revoked", revokedAt: now },
  });

  const updated = await prisma.practiceDocument.update({
    where: { id: documentId },
    data: {
      status: "deleted",
      deletedAt: now,
      deletedByUserId: actorUserId,
    },
    include: docInclude,
  });

  await writePracticeDocumentAudit({
    actorUserId,
    actorRole: "practice",
    practiceProfileId: doc.practiceProfileId,
    patientUserId: doc.patientUserId,
    resourceType: "practice_document",
    resourceId: doc.id,
    action: "deleted",
    reason: reason || null,
    metadata: {
      documentType: doc.type,
      fileCount: doc.files.length,
      previousStatus: doc.status,
    },
  });

  return documentToJson(updated);
}

/**
 * @param {string} patientUserId
 */
export async function listSharedDocumentsForPatient(patientUserId) {
  const rows = await prisma.practiceDocument.findMany({
    where: {
      patientUserId,
      status: "shared",
      shares: {
        some: {
          patientUserId,
          status: "active",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      },
    },
    include: docInclude,
    orderBy: { sharedAt: "desc" },
  });
  return rows.map((r) => documentToJson(r));
}

export async function loadSharedDocumentForPatient(documentId, patientUserId) {
  const doc = await prisma.practiceDocument.findFirst({
    where: { id: documentId, patientUserId },
    include: docInclude,
  });

  if (!doc) throw new Error("document_not_found");
  if (doc.status === "deleted") throw new Error("document_unavailable");

  const hasActiveShare = doc.shares?.some(
    (s) =>
      s.patientUserId === patientUserId &&
      s.status === "active" &&
      !isShareExpired(s),
  );

  if (doc.status !== "shared" || !hasActiveShare) {
    throw new Error("document_unavailable");
  }

  return doc;
}

/**
 * @param {string} documentId
 * @param {string} patientUserId
 */
export async function getSharedDocumentForPatient(documentId, patientUserId) {
  const doc = await loadSharedDocumentForPatient(documentId, patientUserId);
  return documentToJson(doc);
}

/**
 * @param {string} documentId
 * @param {string} fileId
 * @param {string} patientUserId
 */
export async function getSharedDocumentFileForPatient(
  documentId,
  fileId,
  patientUserId,
) {
  await loadSharedDocumentForPatient(documentId, patientUserId);

  const fileRow = await prisma.practiceDocumentFile.findFirst({
    where: { id: fileId, documentId },
  });
  if (!fileRow) throw new Error("file_not_found");

  const buffer = await storage.getObject(fileRow.storageKey);
  return { file: fileRow, buffer };
}

/**
 * @param {string} documentId
 * @param {string} fileId
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function getDocumentFileForPractice(
  documentId,
  fileId,
  linkId,
  practiceProfileId,
) {
  await loadDocumentForPractice(documentId, linkId, practiceProfileId);
  const fileRow = await prisma.practiceDocumentFile.findFirst({
    where: { id: fileId, documentId },
  });
  if (!fileRow) throw new Error("file_not_found");

  const buffer = await storage.getObject(fileRow.storageKey);
  return { file: fileRow, buffer };
}
