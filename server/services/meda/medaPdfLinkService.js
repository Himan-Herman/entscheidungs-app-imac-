import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { getPracticeDocumentStorage } from "../practiceDocument/storage/index.js";
import { createSecureDocumentDownloadLink } from "../practiceDocument/secureDocumentAccessService.js";
import { writeAuditLog } from "../auditLogService.js";

const storage = getPracticeDocumentStorage();

const MEDA_PDF_TTL_MINUTES = 60;

/** Lowercase, path-safe filename ending in .pdf. */
function sanitizeFileName(name) {
  const base = String(name || "meda-protokoll.pdf").trim().slice(0, 200);
  const cleaned = base.replace(/[/\\]+/g, "_").replace(/[^\w.\-]+/g, "_") || "meda-protokoll";
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

/**
 * Stores a Meda session PDF (practice-owned, no linked patient) and returns a
 * time-limited, token-only public download link.
 *
 * Stores ONLY the rendered PDF bytes (Object Storage) plus minimal document
 * metadata. It NEVER stores audio, realtime raw events, conversation turns, or a
 * base64 PDF in the database. Consent is enforced + audited by the caller; no
 * patient ConsentRecord is created for unlinked sessions.
 *
 * @param {{
 *   practiceProfileId: string,
 *   createdByUserId: string,
 *   actorRole: string,
 *   buffer: Buffer,
 *   fileName: string,
 *   mimeType: string,
 * }} input
 * @param {import('express').Request} [req]
 * @returns {Promise<{ url: string, expiresAt: Date, tokenId: string, documentId: string }>}
 */
export async function createMedaPdfLink(input, req) {
  if (input.mimeType !== "application/pdf") throw new Error("validation_invalid_file_type");
  if (!input.buffer?.length) throw new Error("validation_required");

  const practiceProfileId = String(input.practiceProfileId || "").trim();
  const createdByUserId = String(input.createdByUserId || "").trim();
  if (!practiceProfileId || !createdByUserId) throw new Error("validation_required");

  const safeName = sanitizeFileName(input.fileName);

  // 1) Practice-owned document — no patient link (allowed since the migration).
  //    Title/description are generic markers only; they contain NO patient or
  //    conversation content.
  const doc = await prisma.practiceDocument.create({
    data: {
      practiceProfileId,
      patientUserId: null,
      practicePatientLinkId: null,
      type: "other",
      title: "Meda Gesprächsprotokoll",
      description: "Meda Live-Dolmetscher Sitzungs-PDF",
      status: "draft",
      createdByUserId,
    },
    select: { id: true },
  });

  let storageKey = null;
  try {
    // 2) Store the PDF bytes in Object Storage (never in the DB).
    const checksum = crypto.createHash("sha256").update(input.buffer).digest("hex");
    storageKey = await storage.putObject({
      practiceProfileId,
      documentId: doc.id,
      buffer: input.buffer,
      originalFileName: safeName,
    });

    const file = await prisma.practiceDocumentFile.create({
      data: {
        documentId: doc.id,
        storageKey,
        originalFileName: safeName,
        mimeType: "application/pdf",
        sizeBytes: input.buffer.length,
        checksum,
      },
      select: { id: true },
    });

    // 3) Token-only public link, 60-minute TTL. audience 'practice' streams on a
    //    valid token without a login or patient-share check.
    const link = await createSecureDocumentDownloadLink(
      {
        documentId: doc.id,
        fileId: file.id,
        audience: "practice",
        practiceProfileId,
        createdByUserId,
        actorRole: input.actorRole,
        ttlMinutes: MEDA_PDF_TTL_MINUTES,
      },
      req,
    );

    // 4) Consent attestation audit — no content, no patient details.
    writeAuditLog({
      req,
      userId: createdByUserId,
      actorRole: input.actorRole,
      action: "meda_pdf_link_created",
      entityType: "secure_document_link",
      entityId: link.tokenId,
      practiceProfileId,
      metadata: { documentId: doc.id, consentPdfQr: true, ttlMinutes: MEDA_PDF_TTL_MINUTES },
    });

    return {
      url: link.downloadUrl,
      expiresAt: link.expiresAt,
      tokenId: link.tokenId,
      documentId: doc.id,
    };
  } catch (err) {
    // Best-effort cleanup so a failed run leaves no orphaned object/row.
    if (storageKey) {
      try { await storage.deleteObject(storageKey); } catch (_) {}
    }
    try { await prisma.practiceDocument.delete({ where: { id: doc.id } }); } catch (_) {}
    throw err;
  }
}
