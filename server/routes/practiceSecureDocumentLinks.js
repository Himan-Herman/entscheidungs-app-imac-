/**
 * Practice management of secure document download links.
 * PATCH /api/practice/documents/secure-links/:tokenId/revoke?practiceId=
 * GET   /api/practice/documents/secure-links?practiceId=&documentId=
 */

import express from "express";
import { requirePracticeDocumentsV2Feature } from "../middleware/requirePracticeDocumentsV2.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canWritePracticePatientLinks,
  hasPracticePermission,
  PERMISSIONS,
} from "../utils/practiceAccess.js";
import {
  listActiveSecureLinksForDocument,
  revokeSecureDocumentLink,
} from "../services/practiceDocument/secureDocumentAccessService.js";

const router = express.Router();

router.use(requirePracticeDocumentsV2Feature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.get("/secure-links", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  const documentId = String(req.query.documentId || "").trim();
  if (!practiceId || !documentId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !hasPracticePermission(access.role, PERMISSIONS.DOCUMENTS_READ)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const links = await listActiveSecureLinksForDocument(documentId, practiceId);
  return res.json({ ok: true, links });
});

router.patch("/secure-links/:tokenId/revoke", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || req.body?.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const result = await revokeSecureDocumentLink(
      req.params.tokenId,
      practiceId,
      userId,
      access.role,
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err?.message || "request_failed";
    if (msg === "link_not_found") return res.status(404).json({ ok: false, error: msg });
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
