/**
 * Public secure document download — token in path only; PDF content is neutral reference (no clinical text).
 */

import express from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { buildNeutralSecureDocumentPdf } from "../services/secureDocumentPdf.js";
import {
  enqueuePracticeWebhook,
  PracticeWebhookEventType,
} from "../services/practiceWebhookService.js";

const router = express.Router();

function hashToken(raw) {
  return crypto.createHash("sha256").update(String(raw), "utf8").digest("hex");
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

router.get("/:token", async (req, res) => {
  const raw = String(req.params.token || "").trim();
  if (!raw || raw.length > 512) {
    return res.status(400).json({ ok: false, error: "invalid_token" });
  }
  const tokenHash = hashToken(raw);

  const delivery = await prisma.secureDocumentDelivery.findUnique({
    where: { tokenHash },
    include: {
      practiceProfile: { select: { practiceName: true } },
      preVisitSession: { select: { id: true } },
    },
  });

  if (!delivery || delivery.revokedAt) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }
  if (delivery.expiresAt.getTime() < Date.now()) {
    return res.status(410).json({ ok: false, error: "expired" });
  }

  const mark = await prisma.secureDocumentDelivery.updateMany({
    where: { id: delivery.id, downloadedAt: null },
    data: { downloadedAt: new Date() },
  });
  const firstDownload = mark.count > 0;
  if (firstDownload) {
    try {
      await enqueuePracticeWebhook({
        practiceProfileId: delivery.practiceProfileId,
        eventType: PracticeWebhookEventType.SECURE_DOCUMENT_DOWNLOADED,
        payload: {
          secureDocumentDeliveryId: delivery.id,
          preVisitSessionId: delivery.preVisitSessionId,
        },
      });
    } catch {
      /* queue failure must not block download */
    }
  }

  console.info(
    JSON.stringify({
      level: "info",
      event: "secure_document_access",
      deliveryId: delivery.id,
      practiceProfileId: delivery.practiceProfileId,
      preVisitSessionId: delivery.preVisitSessionId,
      clientIp: clientIp(req),
      firstDownload,
    }),
  );

  const pdfBytes = await buildNeutralSecureDocumentPdf({
    practiceName: delivery.practiceProfile?.practiceName || "",
    sessionId: delivery.preVisitSession?.id || "",
    expiresAt: delivery.expiresAt,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="medscoutx-reference-${delivery.id.slice(0, 8)}.pdf"`,
  );
  res.setHeader("Cache-Control", "no-store");
  return res.send(Buffer.from(pdfBytes));
});

export default router;
