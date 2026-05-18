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
  return { status: 500, error: "request_failed" };
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

/** GET /api/patient/practice-documents/:documentId */
router.get("/:documentId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const document = await getSharedDocumentForPatient(req.params.documentId, userId);
    return res.json({ ok: true, document });
  } catch (err) {
    console.error("[patient/practice-documents/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/patient/practice-documents/:documentId/download?fileId= */
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

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.originalFileName)}"`,
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
