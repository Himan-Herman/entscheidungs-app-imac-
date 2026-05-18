import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { getPracticeDocumentStorage } from "./storage/index.js";
import {
  getDocumentFileForPractice,
  getSharedDocumentFileForPatient,
  loadSharedDocumentForPatient,
} from "./practiceDocumentService.js";
import { assertLinkForPractice } from "./practiceDocumentService.js";
import { writeAuditLog } from "../auditLogService.js";

const prisma = new PrismaClient();
const storage = getPracticeDocumentStorage();

const DEFAULT_TTL_MINUTES = 15;
const MAX_TTL_MINUTES = 60;

export function hashSecureDocumentToken(raw) {
  return crypto.createHash("sha256").update(String(raw), "utf8").digest("hex");
}

function generateRawToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function buildDownloadPath(rawToken) {
  return `/api/documents/secure-download/${encodeURIComponent(rawToken)}`;
}

/**
 * @param {import('express').Request} [req]
 * @param {string} path
 */
export function absoluteDownloadUrl(req, path) {
  if (!req) return path;
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) return path;
  return `${proto}://${host}${path}`;
}

/**
 * @param {object} input
 * @param {import('express').Request} [req]
 */
export async function createSecureDocumentDownloadLink(input, req) {
  const documentId = String(input.documentId || "").trim();
  const fileId = String(input.fileId || "").trim();
  const audience = String(input.audience || "").trim();
  if (!documentId || !fileId || !["patient", "practice"].includes(audience)) {
    throw new Error("validation_required");
  }

  let ttlMinutes = Number(input.ttlMinutes) || DEFAULT_TTL_MINUTES;
  if (ttlMinutes < 5) ttlMinutes = 5;
  if (ttlMinutes > MAX_TTL_MINUTES) ttlMinutes = MAX_TTL_MINUTES;

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const rawToken = generateRawToken();
  const tokenHash = hashSecureDocumentToken(rawToken);

  const row = await prisma.secureDocumentAccessToken.create({
    data: {
      documentId,
      fileId,
      tokenHash,
      audience,
      userId: input.userId || null,
      practiceProfileId: input.practiceProfileId || null,
      practicePatientLinkId: input.practicePatientLinkId || null,
      createdByUserId: input.createdByUserId || null,
      expiresAt,
    },
  });

  writeAuditLog({
    req,
    userId: input.createdByUserId,
    actorRole: input.actorRole,
    action: "secure_document_link_created",
    entityType: "secure_document_link",
    entityId: row.id,
    practiceProfileId: row.practiceProfileId,
    patientUserId: audience === "patient" ? input.userId : undefined,
    practicePatientLinkId: row.practicePatientLinkId,
    metadata: { documentId, fileId, audience, expiresAt: expiresAt.toISOString() },
  });

  const path = buildDownloadPath(rawToken);
  return {
    tokenId: row.id,
    downloadUrl: absoluteDownloadUrl(req, path),
    expiresAt,
    expiresInMinutes: ttlMinutes,
  };
}

/**
 * @param {string} rawToken
 */
export async function resolveSecureDocumentToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token || token.length > 512) throw new Error("invalid_token");

  const tokenHash = hashSecureDocumentToken(token);
  const row = await prisma.secureDocumentAccessToken.findUnique({
    where: { tokenHash },
    include: {
      document: { select: { id: true, status: true, patientUserId: true, practiceProfileId: true } },
      file: true,
    },
  });

  if (!row || row.revokedAt) throw new Error("link_revoked");
  if (row.expiresAt.getTime() < Date.now()) throw new Error("link_expired");
  if (!row.file) throw new Error("file_not_found");
  if (row.document.status === "deleted") throw new Error("document_unavailable");

  return { token: row, rawToken };
}

/**
 * Stream file for a valid token; marks first use timestamp.
 * @param {string} rawToken
 * @param {{ req?: import('express').Request }} ctx
 */
export async function streamSecureDocumentDownload(rawToken, ctx = {}) {
  const { token: row } = await resolveSecureDocumentToken(rawToken);

  if (row.audience === "patient") {
    await loadSharedDocumentForPatient(row.documentId, row.document.patientUserId);
  }

  const buffer = await storage.getObject(row.file.storageKey);
  const now = new Date();

  if (!row.usedAt) {
    await prisma.secureDocumentAccessToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    });
  }

  writeAuditLog({
    req: ctx.req,
    userId: row.userId,
    actorRole: row.audience,
    action: row.usedAt ? "secure_document_link_used" : "secure_document_download_started",
    entityType: "secure_document_link",
    entityId: row.id,
    practiceProfileId: row.practiceProfileId,
    patientUserId: row.document.patientUserId,
    practicePatientLinkId: row.practicePatientLinkId,
    metadata: {
      documentId: row.documentId,
      fileId: row.fileId,
      mimeType: row.file.mimeType,
    },
  });

  return { file: row.file, buffer };
}

/**
 * @param {string} tokenId
 * @param {string} practiceProfileId
 * @param {string} actorUserId
 * @param {string} actorRole
 * @param {{ req?: import('express').Request }} ctx
 */
export async function revokeSecureDocumentLink(tokenId, practiceProfileId, actorUserId, actorRole, ctx = {}) {
  const id = String(tokenId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  if (!id || !pid) throw new Error("validation_required");

  const row = await prisma.secureDocumentAccessToken.findFirst({
    where: { id, practiceProfileId: pid },
  });
  if (!row) throw new Error("link_not_found");
  if (row.revokedAt) return { id: row.id, revoked: true };

  const updated = await prisma.secureDocumentAccessToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole,
    action: "secure_document_link_revoked",
    entityType: "secure_document_link",
    entityId: updated.id,
    practiceProfileId: pid,
    practicePatientLinkId: updated.practicePatientLinkId,
    metadata: { documentId: updated.documentId, fileId: updated.fileId },
  });

  return { id: updated.id, revoked: true };
}

/**
 * @param {string} documentId
 * @param {string} practiceProfileId
 */
export async function listActiveSecureLinksForDocument(documentId, practiceProfileId) {
  const rows = await prisma.secureDocumentAccessToken.findMany({
    where: {
      documentId,
      practiceProfileId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      fileId: true,
      audience: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
  });
  return rows;
}

/**
 * Patient authenticated download link.
 */
export async function createPatientDocumentDownloadLink(documentId, fileId, patientUserId, req) {
  await loadSharedDocumentForPatient(documentId, patientUserId);
  const doc = await prisma.practiceDocument.findUnique({
    where: { id: documentId },
    select: {
      practiceProfileId: true,
      practicePatientLinkId: true,
    },
  });
  return createSecureDocumentDownloadLink(
    {
      documentId,
      fileId,
      audience: "patient",
      userId: patientUserId,
      practiceProfileId: doc?.practiceProfileId,
      practicePatientLinkId: doc?.practicePatientLinkId,
      createdByUserId: patientUserId,
      actorRole: "patient",
    },
    req,
  );
}

/**
 * Practice secure link (for sharing externally / time-limited).
 */
export async function createPracticeDocumentDownloadLink(
  documentId,
  fileId,
  linkId,
  practiceProfileId,
  createdByUserId,
  actorRole,
  req,
) {
  const link = await assertLinkForPractice(linkId, practiceProfileId, {
    actorUserId: createdByUserId,
    actorRole,
    req,
  });
  const { assertConsentForLink } = await import("../consent/consentRecordService.js");
  await assertConsentForLink(link, "optional_secure_links", {
    actorUserId: createdByUserId,
    actorRole,
    req,
  });
  const doc = await prisma.practiceDocument.findFirst({
    where: { id: documentId, practicePatientLinkId: linkId, practiceProfileId },
  });
  if (!doc) throw new Error("document_not_found");
  if (doc.status === "deleted") throw new Error("document_unavailable");

  return createSecureDocumentDownloadLink(
    {
      documentId,
      fileId,
      audience: "practice",
      practiceProfileId,
      practicePatientLinkId: linkId,
      createdByUserId,
      actorRole,
    },
    req,
  );
}

export async function practiceDirectDownload(documentId, fileId, linkId, practiceProfileId) {
  if (!fileId) throw new Error("validation_required");
  const doc = await prisma.practiceDocument.findFirst({
    where: { id: documentId, practicePatientLinkId: linkId, practiceProfileId },
  });
  if (!doc) throw new Error("document_not_found");
  if (doc.status === "deleted") throw new Error("document_unavailable");
  return getDocumentFileForPractice(documentId, fileId, linkId, practiceProfileId);
}

export { getSharedDocumentFileForPatient, getDocumentFileForPractice };
