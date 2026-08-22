/**
 * Patient documents INSIDE one care relationship —
 * /api/patient/practice/:linkId/documents
 *
 * Distinct from routes/patientPracticeDocuments.js, which is the older
 * cross-practice list (`/api/patient/practice-documents`). Both delegate to the
 * same service; only the scope differs.
 *
 * WHAT MAY APPEAR HERE
 * --------------------
 * Exactly two classes, decided in the database query, never by filtering
 * afterwards:
 *
 *   DIRECT — this link's own document, released to the patient by the practice.
 *   SHARED — a document the patient released INTO this link with a currently
 *            effective PracticeDocumentShareGrant.
 *
 * A document of another link with no effective grant matches neither branch, so
 * it cannot be listed, fetched or downloaded here — not through a manipulated
 * documentId, not through a linkId that is not the patient's, and not because
 * the same person happens to own both documents.
 *
 * AUTHORIZATION
 * -------------
 * Session user + linkId from the path. No practiceId, patientId, grantId or
 * token is accepted as proof of anything. Downloads re-derive authorization at
 * request time, so a revoked grant blocks a download the client still offers.
 */

import express from "express";
import {
  getPatientLinkDocument,
  getPatientLinkDocumentFile,
  listPatientLinkDocuments,
} from "../services/practiceDocument/practiceDocumentService.js";

const router = express.Router({ mergeParams: true });

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required") return { status: 400, error: msg };
  // A foreign link, a foreign document and a missing one are all "not found",
  // so none of them can be used to probe what exists.
  if (
    msg === "link_not_found" ||
    msg === "document_not_found" ||
    msg === "document_unavailable" ||
    msg === "file_not_found"
  ) {
    return { status: 404, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/** GET / — documents of this care relationship */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const documents = await listPatientLinkDocuments(req.params.linkId, userId);
    return res.json({ ok: true, documents });
  } catch (err) {
    console.error("[patient/practice/documents/list]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** GET /:documentId */
router.get("/:documentId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { json } = await getPatientLinkDocument(
      req.params.linkId,
      req.params.documentId,
      userId,
    );
    return res.json({ ok: true, document: json });
  } catch (err) {
    console.error("[patient/practice/documents/get]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/**
 * GET /:documentId/files/:fileId/download
 *
 * Streams the file only if the document is STILL in this context right now. No
 * token is involved: the session and the link decide on every request, so a
 * revoked grant takes effect immediately and nothing replayable is handed out.
 */
router.get("/:documentId/files/:fileId/download", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { file, buffer } = await getPatientLinkDocumentFile(
      req.params.linkId,
      req.params.documentId,
      req.params.fileId,
      userId,
    );

    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.originalFileName || "document")}"`,
    );
    // Medical content must not sit in a shared cache.
    res.setHeader("Cache-Control", "no-store, private");
    return res.send(buffer);
  } catch (err) {
    console.error("[patient/practice/documents/download]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
