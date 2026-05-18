/**
 * Practice documents on a care link — /api/practice/patients/:linkId/documents
 */

import express from "express";
import { requirePracticeDocumentsV2Feature } from "../middleware/requirePracticeDocumentsV2.js";
import { uploadPracticeDocument } from "../middleware/uploadPracticeDocument.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canWritePracticePatientLinks,
} from "../utils/practiceAccess.js";
import {
  archiveDocument,
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
import { writeAuditLog } from "../services/auditLogService.js";

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
    msg === "document_already_deleted"
  ) {
    return { status: 409, error: msg };
  }
  if (msg === "ai_not_configured") {
    return { status: 503, error: msg };
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

/** PATCH /api/practice/patients/:linkId/documents/:documentId/delete — soft delete */
router.patch("/:documentId/delete", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
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
