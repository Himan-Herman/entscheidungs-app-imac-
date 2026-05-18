/**
 * Patient practice documents — /api/patient/practice-documents (shared only)
 */

import express from "express";
import { requirePracticeDocumentsV2Feature } from "../middleware/requirePracticeDocumentsV2.js";
import {
  getSharedDocumentFileForPatient,
  getSharedDocumentForPatient,
  listSharedDocumentsForPatient,
} from "../services/practiceDocument/practiceDocumentService.js";
import { submitPatientPracticeDocumentQuestion } from "../services/practiceDocument/patientPracticeDocumentQuestionService.js";
import { createPatientDocumentDownloadLink } from "../services/practiceDocument/secureDocumentAccessService.js";
import { generateDocumentDownloadAiNote } from "../services/practiceDocument/practiceDocumentDownloadAiService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { requireDocumentOcrFeature } from "../middleware/requireDocumentOcr.js";
import { getPatientStructuredDocument } from "../services/practiceDocument/documentOcrService.js";

const router = express.Router();

router.use(requirePracticeDocumentsV2Feature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "document_unavailable") {
    return { status: 410, error: msg };
  }
  if (msg === "document_not_found" || msg === "file_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "link_not_active") {
    return { status: 409, error: msg };
  }
  if (msg === "forbidden") return { status: 403, error: msg };
  if (msg === "link_expired" || msg === "link_revoked" || msg === "invalid_token") {
    return { status: 410, error: msg };
  }
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  return { status: 500, error: "request_failed" };
}

function documentAuditMetadata(doc) {
  return {
    practicePatientLinkId: doc.practicePatientLinkId,
    practiceProfileId: doc.practiceProfileId,
    patientUserId: doc.patientUserId,
  };
}

/** GET /api/patient/practice-documents */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const documents = await listSharedDocumentsForPatient(userId);
    return res.json({ ok: true, documents });
  } catch (err) {
    console.error("[patient/practice-documents/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/patient/practice-documents/:documentId/structured */
router.get("/:documentId/structured", requireDocumentOcrFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const out = await getPatientStructuredDocument(req.params.documentId, userId, { req });

    await writeAuditLog({
      req,
      userId,
      actorRole: "patient",
      action: "document_ocr_structured_opened",
      entityType: "document_ocr_job",
      entityId: req.params.documentId,
      metadata: { documentId: req.params.documentId, patientUserId: userId },
    });

    return res.json({ ok: true, ...out });
  } catch (err) {
    console.error("[patient/practice-documents/structured]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/patient/practice-documents/:documentId */
router.get("/:documentId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const document = await getSharedDocumentForPatient(req.params.documentId, userId);

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action: "practice_document_opened",
      entityType: "practice_document",
      entityId: document.id,
      metadata: documentAuditMetadata(document),
    });

    return res.json({ ok: true, document });
  } catch (err) {
    console.error("[patient/practice-documents/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/practice-documents/:documentId/question */
router.post("/:documentId/question", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await submitPatientPracticeDocumentQuestion(
      req.params.documentId,
      userId,
    );

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action: "practice_document_question",
      entityType: "practice_document",
      entityId: req.params.documentId,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/practice-documents/question]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/practice-documents/:documentId/download-link */
router.post("/:documentId/download-link", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const fileId = String(req.body?.fileId || "").trim();
  if (!fileId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  try {
    const link = await createPatientDocumentDownloadLink(
      req.params.documentId,
      fileId,
      userId,
      req,
    );
    return res.json({ ok: true, ...link });
  } catch (err) {
    console.error("[patient/practice-documents/download-link]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/practice-documents/:documentId/ai-download-note */
router.post("/:documentId/ai-download-note", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const document = await getSharedDocumentForPatient(req.params.documentId, userId);
    const file = document.files?.[0];
    const result = await generateDocumentDownloadAiNote(
      {
        documentType: document.type,
        fileName: file?.originalFileName,
        mimeType: file?.mimeType,
        locale: req.body?.locale,
        userId,
        actorRole: "patient",
        documentId: document.id,
        practiceProfileId: document.practiceProfileId,
      },
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/practice-documents/ai-download-note]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/patient/practice-documents/:documentId/download?fileId=&disposition=inline|attachment */
router.get("/:documentId/download", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const fileId = String(req.query.fileId || "").trim();
  if (!fileId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  try {
    const { file, buffer } = await getSharedDocumentFileForPatient(
      req.params.documentId,
      fileId,
      userId,
    );

    const document = await getSharedDocumentForPatient(req.params.documentId, userId);

    const disposition =
      String(req.query.disposition || "").trim() === "inline" &&
      file.mimeType === "application/pdf"
        ? "inline"
        : "attachment";

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action:
        disposition === "inline"
          ? "practice_document_viewed"
          : "practice_document_download",
      entityType: "document_download",
      entityId: fileId,
      metadata: documentAuditMetadata(document),
    });

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(file.originalFileName)}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(buffer);
  } catch (err) {
    console.error("[patient/practice-documents/download]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
