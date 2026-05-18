/**
 * Public secure document download — token in path only (hashed at rest).
 * GET /api/documents/secure-download/:token
 */

import express from "express";
import { streamSecureDocumentDownload } from "../services/practiceDocument/secureDocumentAccessService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { logSecurityEvent } from "../services/security/securityEventService.js";

const router = express.Router();

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "invalid_token" || msg === "link_revoked" || msg === "link_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "link_expired" || msg === "document_unavailable") {
    return { status: 410, error: msg };
  }
  if (msg === "forbidden") return { status: 403, error: msg };
  return { status: 500, error: "request_failed" };
}

router.get("/:token", async (req, res) => {
  try {
    const { file, buffer } = await streamSecureDocumentDownload(req.params.token, { req });

    const disposition =
      String(req.query.disposition || "").trim() === "inline" &&
      file.mimeType === "application/pdf"
        ? "inline"
        : "attachment";

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(file.originalFileName)}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(buffer);
  } catch (err) {
    const mapped = mapError(err);
    writeAuditLog({
      req,
      action: "secure_document_access_denied",
      entityType: "secure_document_link",
      metadata: { error: mapped.error },
    });
    if (mapped.error === "link_expired" || mapped.error === "link_revoked") {
      logSecurityEvent({
        req,
        eventType: mapped.error === "link_expired" ? "secure_link_expired" : "revoked_resource_access",
        metadata: { resource: "secure_document_link" },
      });
    } else if (mapped.error === "invalid_token" || mapped.error === "link_not_found") {
      logSecurityEvent({
        req,
        eventType: "invalid_token",
        metadata: { resource: "secure_document_link" },
      });
    }
    if (mapped.status >= 500) {
      console.error("[secure-download]", err?.message ?? err);
    }
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
