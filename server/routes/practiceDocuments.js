/**
 * Practice documents on a care link — /api/practice/patients/:linkId/documents
 */

import express from "express";
import { requirePracticeDocumentsV2Feature } from "../middleware/requirePracticeDocumentsV2.js";
import { requireDocumentOcrFeature } from "../middleware/requireDocumentOcr.js";
import {
  hasPracticePermission,
  PERMISSIONS,
} from "../utils/practicePermissions.js";
import { uploadPracticeDocument } from "../middleware/uploadPracticeDocument.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canWritePracticePatientLinks,
  canPracticeSoftDelete,
  canPracticeRestoreFromArchive,
} from "../utils/practiceAccess.js";
import { parseIncludeArchived } from "../utils/lifecycleStatus.js";
import {
  archiveDocument,
  restoreArchivedDocument,
  softDeletePracticeDocument,
  createPracticeDocumentDraft,
  getDocumentForPractice,
  getDocumentFileForPractice,
  listDocumentsForPracticePatient,
  revokeDocumentShare,
  shareDocumentWithPatient,
  updatePracticeDocumentDraft,
  uploadPracticeDocumentFile,
} from "../services/practiceDocument/practiceDocumentService.js";
import {
  generatePracticeDocumentAiOrganize,
  generatePracticeDocumentAiTitleDraft,
} from "../services/practiceDocument/practiceDocumentAiService.js";
import { generateDocumentDownloadAiNote } from "../services/practiceDocument/practiceDocumentDownloadAiService.js";
import {
  createPracticeDocumentDownloadLink,
  practiceDirectDownload,
} from "../services/practiceDocument/secureDocumentAccessService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import {
  discardDocumentOcrResult,
  getDocumentOcrResult,
  getDocumentOcrStatus,
  patchDocumentOcrResult,
  shareDocumentOcrResult,
  startDocumentOcr,
} from "../services/practiceDocument/documentOcrService.js";

function documentAuditMetadata(doc) {
  return {
    practicePatientLinkId: doc.practicePatientLinkId,
    practiceProfileId: doc.practiceProfileId,
    patientUserId: doc.patientUserId,
  };
}

const router = express.Router({ mergeParams: true });

router.use(requirePracticeDocumentsV2Feature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function practiceIdFromReq(req) {
  return String(req.query.practiceId || req.body?.practiceId || "").trim();
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (
    msg === "validation_required" ||
    msg === "validation_text_too_long" ||
    msg === "validation_invalid_type" ||
    msg === "validation_invalid_file_type" ||
    msg === "validation_file_too_large" ||
    msg === "validation_too_many_files"
  ) {
    return { status: 400, error: msg };
  }
  if (
    msg === "link_not_found" ||
    msg === "document_not_found" ||
    msg === "file_not_found"
  ) {
    return { status: 404, error: msg };
  }
  if (
    msg === "link_not_active" ||
    msg === "document_not_editable" ||
    msg === "document_not_shared" ||
    msg === "document_archived" ||
    msg === "document_already_archived" ||
    msg === "document_deleted" ||
    msg === "document_already_deleted" ||
    msg === "document_not_archived"
  ) {
    return { status: 409, error: msg };
  }
  if (msg === "ai_not_configured") {
    return { status: 503, error: msg };
  }
  if (msg === "forbidden" || msg === "consent_required") return { status: 403, error: msg };
  if (
    msg === "feature_disabled" ||
    msg === "ocr_unavailable" ||
    msg === "ocr_disabled" ||
    msg === "external_ocr_unavailable" ||
    msg === "ocr_result_not_found" ||
    msg === "ocr_result_discarded" ||
    msg === "ocr_not_ready_to_share" ||
    msg === "ocr_job_in_progress"
  ) {
    const status = msg === "feature_disabled" ? 404 : msg === "ocr_job_in_progress" ? 409 : 503;
    return { status, error: msg };
  }
  if (msg === "link_expired" || msg === "link_revoked" || msg === "document_unavailable") {
    return { status: 410, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

async function requirePracticeAccess(req) {
  const userId = userIdFromReq(req);
  if (!userId) return { error: { status: 401, body: { ok: false, error: "unauthorized" } } };

  const practiceId = practiceIdFromReq(req);
  if (!practiceId) {
    return {
      error: {
        status: 400,
        body: { ok: false, error: "validation_required" },
      },
    };
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access) {
    return { error: { status: 403, body: { ok: false, error: "forbidden" } } };
  }

  return { userId, practiceId, access };
}

/** GET /api/practice/patients/:linkId/documents */
router.get("/", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canReadPracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const documents = await listDocumentsForPracticePatient(
      req.params.linkId,
      ctx.practiceId,
      { includeArchived: parseIncludeArchived(req) },
    );
    return res.json({ ok: true, documents });
  } catch (err) {
    console.error("[practice/documents/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/documents */
router.post("/", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const document = await createPracticeDocumentDraft(
      req.params.linkId,
      ctx.practiceId,
      ctx.userId,
      {
        type: req.body?.type,
        title: req.body?.title,
        description: req.body?.description,
      },
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_document_created",
      entityType: "practice_document",
      entityId: document.id,
      metadata: documentAuditMetadata(document),
    });

    return res.status(201).json({ ok: true, document });
  } catch (err) {
    console.error("[practice/documents/create]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/documents/ai-title-draft */
router.post("/ai-title-draft", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const draft = await generatePracticeDocumentAiTitleDraft({
      linkId: req.params.linkId,
      practiceProfileId: ctx.practiceId,
      type: req.body?.type,
      title: req.body?.title,
      description: req.body?.description,
      locale: req.body?.locale || req.headers["accept-language"],
    });

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_document_ai_title_draft",
      entityType: "practice_document",
      entityId: req.params.linkId,
      metadata: { practiceProfileId: ctx.practiceId },
    });

    return res.json({ ok: true, ...draft });
  } catch (err) {
    console.error("[practice/documents/ai-title]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/documents/:documentId/download-link */
router.post("/:documentId/download-link", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!hasPracticePermission(ctx.access.role, PERMISSIONS.DOCUMENTS_READ)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const fileId = String(req.body?.fileId || "").trim();
  if (!fileId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  try {
    const link = await createPracticeDocumentDownloadLink(
      req.params.documentId,
      fileId,
      req.params.linkId,
      ctx.practiceId,
      ctx.userId,
      ctx.access.role,
      req,
    );
    return res.json({ ok: true, ...link });
  } catch (err) {
    console.error("[practice/documents/download-link]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/documents/:documentId/ai-download-note */
router.post("/:documentId/ai-download-note", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canReadPracticePatientLinks(ctx.access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const document = await getDocumentForPractice(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
    );
    const file = document.files?.[0];
    const result = await generateDocumentDownloadAiNote(
      {
        documentType: document.type,
        fileName: file?.originalFileName,
        mimeType: file?.mimeType,
        locale: req.body?.locale,
        userId: ctx.userId,
        actorRole: ctx.access.role,
        documentId: document.id,
        practiceProfileId: ctx.practiceId,
      },
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/documents/ai-download-note]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patients/:linkId/documents/:documentId/download?fileId=&disposition= */
router.get("/:documentId/download", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!hasPracticePermission(ctx.access.role, PERMISSIONS.DOCUMENTS_READ)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const fileId = String(req.query.fileId || "").trim();
  if (!fileId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  try {
    const { file, buffer } = await practiceDirectDownload(
      req.params.documentId,
      fileId,
      req.params.linkId,
      ctx.practiceId,
    );

    const document = await getDocumentForPractice(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
    );

    const disposition =
      String(req.query.disposition || "").trim() === "inline" &&
      file.mimeType === "application/pdf"
        ? "inline"
        : "attachment";

    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
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
    console.error("[practice/documents/download]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** OCR / lab structuring — organizational only */
router.post("/:documentId/ocr/start", requireDocumentOcrFeature, async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  const fileId = String(req.body?.fileId || "").trim();
  if (!fileId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  try {
    const doc = await getDocumentForPractice(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
    );
    const out = await startDocumentOcr(
      ctx.userId,
      ctx.practiceId,
      req.params.linkId,
      req.params.documentId,
      {
        fileId,
        engine: req.body?.engine,
        locale: req.body?.locale,
      },
      { req, access: ctx.access },
    );

    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "document_ocr_queued",
      entityType: "document_ocr_job",
      entityId: out.job.id,
      metadata: {
        documentId: req.params.documentId,
        practiceProfileId: ctx.practiceId,
        practicePatientLinkId: req.params.linkId,
        patientUserId: doc.patientUserId,
      },
    });

    return res.status(202).json({ ok: true, ...out });
  } catch (err) {
    if (err?.consentType) {
      return res.status(403).json({ ok: false, error: "consent_required", consentType: err.consentType });
    }
    console.error("[practice/documents/ocr/start]", err?.message ?? err);
    const mapped = mapError(err);
    if (mapped.error === "ocr_unavailable" || mapped.error === "ocr_disabled") {
      await writeAuditLog({
        req,
        userId: ctx.userId,
        actorRole: ctx.access.role,
        action: "document_ocr_failed",
        entityType: "document_ocr_job",
        entityId: req.params.documentId,
        metadata: {
          documentId: req.params.documentId,
          practiceProfileId: ctx.practiceId,
          errorCode: mapped.error,
        },
      }).catch(() => {});
    }
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/:documentId/ocr/status", requireDocumentOcrFeature, async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const out = await getDocumentOcrStatus(
      ctx.practiceId,
      req.params.linkId,
      req.params.documentId,
      { access: ctx.access },
    );
    return res.json({ ok: true, ...out });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/:documentId/ocr/result", requireDocumentOcrFeature, async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const out = await getDocumentOcrResult(
      ctx.practiceId,
      req.params.linkId,
      req.params.documentId,
      { access: ctx.access },
    );

    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "document_ocr_result_opened",
      entityType: "document_ocr_job",
      entityId: out.job?.id || req.params.documentId,
      metadata: {
        documentId: req.params.documentId,
        practiceProfileId: ctx.practiceId,
        practicePatientLinkId: req.params.linkId,
      },
    }).catch(() => {});

    return res.json({ ok: true, ...out });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.patch("/:documentId/ocr/result", requireDocumentOcrFeature, async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const out = await patchDocumentOcrResult(
      ctx.userId,
      ctx.practiceId,
      req.params.linkId,
      req.params.documentId,
      req.body || {},
      { req, access: ctx.access },
    );

    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "document_ocr_result_corrected",
      entityType: "document_ocr_job",
      entityId: req.params.documentId,
      metadata: {
        documentId: req.params.documentId,
        practiceProfileId: ctx.practiceId,
        practicePatientLinkId: req.params.linkId,
      },
    });

    return res.json({ ok: true, ...out });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/:documentId/ocr/share", requireDocumentOcrFeature, async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const doc = await getDocumentForPractice(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
    );
    const out = await shareDocumentOcrResult(
      ctx.userId,
      ctx.practiceId,
      req.params.linkId,
      req.params.documentId,
      { req, access: ctx.access },
    );

    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "document_ocr_result_shared",
      entityType: "document_ocr_job",
      entityId: req.params.documentId,
      metadata: {
        documentId: req.params.documentId,
        practiceProfileId: ctx.practiceId,
        practicePatientLinkId: req.params.linkId,
        patientUserId: doc.patientUserId,
      },
    });

    return res.json({ ok: true, ...out });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.patch("/:documentId/ocr/discard", requireDocumentOcrFeature, async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const out = await discardDocumentOcrResult(
      ctx.userId,
      ctx.practiceId,
      req.params.linkId,
      req.params.documentId,
      { req, access: ctx.access },
    );

    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "document_ocr_result_discarded",
      entityType: "document_ocr_job",
      entityId: req.params.documentId,
      metadata: {
        documentId: req.params.documentId,
        practiceProfileId: ctx.practiceId,
        practicePatientLinkId: req.params.linkId,
      },
    });

    return res.json({ ok: true, ...out });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patients/:linkId/documents/:documentId */
router.get("/:documentId", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canReadPracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const document = await getDocumentForPractice(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
    );
    return res.json({ ok: true, document });
  } catch (err) {
    console.error("[practice/documents/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/documents/:documentId/files */
router.post(
  "/:documentId/files",
  (req, res, next) => {
    uploadPracticeDocument.single("file")(req, res, (err) => {
      if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ ok: false, error: "validation_file_too_large" });
      }
      if (err) {
        return res.status(400).json({ ok: false, error: "validation_required" });
      }
      return next();
    });
  },
  async (req, res) => {
    const ctx = await requirePracticeAccess(req);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
    if (!canWritePracticePatientLinks(ctx.access)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ ok: false, error: "validation_required" });
    }

    try {
      const document = await uploadPracticeDocumentFile(
        req.params.documentId,
        req.params.linkId,
        ctx.practiceId,
        {
          buffer: req.file.buffer,
          originalFileName: req.file.originalname,
          mimeType: req.file.mimetype,
        },
      );

      await writeAuditLog({
        userId: ctx.userId,
        actorRole: ctx.access.role,
        action: "practice_document_file_uploaded",
        entityType: "PracticeDocument",
        entityId: document.id,
      });

      return res.status(201).json({ ok: true, document });
    } catch (err) {
      console.error("[practice/documents/upload]", err?.message ?? err);
      const mapped = mapError(err);
      return res.status(mapped.status).json({ ok: false, error: mapped.error });
    }
  },
);

/** POST /api/practice/patients/:linkId/documents/:documentId/share */
router.post("/:documentId/share", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const document = await shareDocumentWithPatient(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
      ctx.userId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_document_shared",
      entityType: "practice_document_share",
      entityId: document.id,
      metadata: documentAuditMetadata(document),
    });

    return res.json({ ok: true, document });
  } catch (err) {
    console.error("[practice/documents/share]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/patients/:linkId/documents/:documentId/revoke */
router.patch("/:documentId/revoke", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const document = await revokeDocumentShare(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_document_share_revoked",
      entityType: "PracticeDocument",
      entityId: document.id,
    });

    return res.json({ ok: true, document });
  } catch (err) {
    console.error("[practice/documents/revoke]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/patients/:linkId/documents/:documentId/archive */
router.patch("/:documentId/archive", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const document = await archiveDocument(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
      ctx.userId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_document_archived",
      entityType: "practice_document",
      entityId: document.id,
      metadata: documentAuditMetadata(document),
    });

    return res.json({ ok: true, document });
  } catch (err) {
    console.error("[practice/documents/archive]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/patients/:linkId/documents/:documentId/restore */
router.patch("/:documentId/restore", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canPracticeRestoreFromArchive(ctx.access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const document = await restoreArchivedDocument(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
      ctx.userId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_document_restored",
      entityType: "practice_document",
      entityId: document.id,
      metadata: documentAuditMetadata(document),
    });

    return res.json({ ok: true, document });
  } catch (err) {
    console.error("[practice/documents/restore]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/patients/:linkId/documents/:documentId/delete — soft delete */
router.patch("/:documentId/delete", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canPracticeSoftDelete(ctx.access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const document = await softDeletePracticeDocument(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
      ctx.userId,
      req.body?.reason,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_document_deleted",
      entityType: "practice_document",
      entityId: document.id,
      metadata: { ...documentAuditMetadata(document), softDelete: true },
    });

    return res.json({ ok: true, document });
  } catch (err) {
    console.error("[practice/documents/delete]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/patients/:linkId/documents/:documentId — draft metadata only */
router.patch("/:documentId", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const document = await updatePracticeDocumentDraft(
      req.params.documentId,
      req.params.linkId,
      ctx.practiceId,
      {
        type: req.body?.type,
        title: req.body?.title,
        description: req.body?.description,
      },
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_document_updated",
      entityType: "practice_document",
      entityId: document.id,
      metadata: documentAuditMetadata(document),
    });

    return res.json({ ok: true, document });
  } catch (err) {
    console.error("[practice/documents/update-draft]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
