/**
 * Secure Meda PDF-QR link.
 * POST /api/practice/meda/pdf-link  (multipart/form-data)
 *
 * Accepts a rendered Meda session PDF and returns a time-limited, token-only
 * public download link (reusing the existing secure-document infrastructure).
 * Stores ONLY the PDF bytes (Object Storage) + minimal document metadata — never
 * audio, realtime raw data, conversation turns, or a base64 PDF in the database.
 */

import express from "express";
import { uploadPracticeDocument } from "../middleware/uploadPracticeDocument.js";
import {
  getPracticeAccess,
  hasPracticePermission,
  PERMISSIONS,
} from "../utils/practiceAccess.js";
import { isPracticePdfStorageEnabled } from "../config/featureFlags.js";
import { createMedaPdfLink } from "../services/meda/medaPdfLinkService.js";

const router = express.Router();

const uploadSingle = uploadPracticeDocument.single("pdf");

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.post("/pdf-link", (req, res) => {
  // Run multer manually so file-size / upload errors return clean status codes.
  uploadSingle(req, res, (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ ok: false, error: "file_too_large" });
      }
      return res.status(400).json({ ok: false, error: "upload_failed" });
    }
    handlePdfLink(req, res).catch(() => {
      res.status(500).json({ ok: false, error: "request_failed" });
    });
  });
});

async function handlePdfLink(req, res) {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "validation_required" });

  // Feature flag — off by default.
  if (!isPracticePdfStorageEnabled()) {
    return res.status(403).json({ ok: false, error: "feature_disabled" });
  }

  // Practice access + write permission.
  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !hasPracticePermission(access.role, PERMISSIONS.DOCUMENTS_WRITE)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  // Explicit consent attestation — multipart sends strings.
  const consent = req.body?.consentPdfQr;
  if (consent !== true && consent !== "true") {
    return res.status(403).json({ ok: false, error: "consent_required" });
  }

  // File presence + type.
  const file = req.file;
  if (!file || !file.buffer?.length) {
    return res.status(400).json({ ok: false, error: "file_required" });
  }
  if (file.mimetype !== "application/pdf") {
    return res.status(400).json({ ok: false, error: "invalid_file_type" });
  }

  try {
    const result = await createMedaPdfLink(
      {
        practiceProfileId: practiceId,
        createdByUserId: userId,
        actorRole: access.role,
        buffer: file.buffer,
        fileName: String(req.body?.fileName || file.originalname || "meda-protokoll.pdf"),
        mimeType: file.mimetype,
      },
      req,
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err?.message || "request_failed";
    if (msg === "validation_invalid_file_type") {
      return res.status(400).json({ ok: false, error: "invalid_file_type" });
    }
    if (msg === "validation_required") {
      return res.status(400).json({ ok: false, error: "validation_required" });
    }
    // Storage / unexpected error — clean 500, no content in the log.
    console.error("[medaPdfLink] failed:", msg);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
}

export default router;
