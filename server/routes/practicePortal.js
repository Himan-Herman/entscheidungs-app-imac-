/**
 * Practice portal: secure document links, calendar export (neutral).
 * Requires practice membership; mutating actions require owner/admin.
 */

import express from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import {
  canManageIntegrations,
  canViewIntegrationSettings,
  getPracticeAccess,
} from "../utils/practiceAccess.js";
import { DOCUMENT_DELIVERY_MODES } from "../constants/practiceIntegrationWebhookEvents.js";
import { buildNeutralSecureDocumentPdf } from "../services/secureDocumentPdf.js";
import {
  enqueuePracticeWebhook,
  PracticeWebhookEventType,
} from "../services/practiceWebhookService.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(String(raw), "utf8").digest("hex");
}

function toIcsDateUtc(d) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** POST .../secure-link ?practiceProfileId= */
router.post(
  "/previsit-sessions/:sessionId/secure-link",
  async (req, res) => {
    const userId = userIdFromReq(req);
    const practiceId = String(req.query.practiceProfileId || "").trim();
    const sessionId = String(req.params.sessionId || "").trim();
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
    if (!practiceId || !sessionId) {
      return res.status(400).json({ ok: false, error: "missing_params" });
    }
    const access = await getPracticeAccess(userId, practiceId);
    if (!access || !canManageIntegrations(access.role)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    const settings = await prisma.practiceIntegrationSettings.findUnique({
      where: { practiceProfileId: practiceId },
    });
    const secureOn = settings?.secureDownloadEnabled !== false;
    const mode = settings?.documentDeliveryMode || "secure_portal";
    if (!secureOn) {
      return res.status(400).json({
        ok: false,
        error: "secure_download_disabled",
      });
    }
    if (!DOCUMENT_DELIVERY_MODES.includes(mode)) {
      return res.status(400).json({ ok: false, error: "invalid_delivery_settings" });
    }
    if (mode === "download_only" || mode === "email") {
      return res.status(400).json({
        ok: false,
        error: "delivery_mode_blocks_secure_link",
      });
    }

    const session = await prisma.preVisitSession.findFirst({
      where: { id: sessionId, practiceProfileId: practiceId },
      include: { practiceProfile: true },
    });
    if (!session) return res.status(404).json({ ok: false, error: "not_found" });

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const ttlDays = Math.min(
      Math.max(Number(req.body?.ttlDays) || 7, 1),
      30,
    );
    const expiresAt = new Date(Date.now() + ttlDays * 864e5);

    const delivery = await prisma.secureDocumentDelivery.create({
      data: {
        practiceProfileId: practiceId,
        preVisitSessionId: sessionId,
        createdByUserId: userId,
        tokenHash,
        expiresAt,
        deliveryType: "secure_link",
      },
    });

    writeAuditLog({
      req,
      userId,
      actorRole: access.role,
      action: "secure_document_delivery_created",
      entityType: "SecureDocumentDelivery",
      entityId: delivery.id,
      metadata: { practiceProfileId: practiceId, preVisitSessionId: sessionId },
    });

    try {
      await enqueuePracticeWebhook({
        practiceProfileId: practiceId,
        eventType: PracticeWebhookEventType.SECURE_DOCUMENT_CREATED,
        payload: {
          secureDocumentDeliveryId: delivery.id,
          preVisitSessionId: sessionId,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch {
      /* queue persistence optional — link already created */
    }

    const base =
      process.env.PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      process.env.APP_BASE_URL ||
      "";
    const publicPath = `/api/public/documents/${rawToken}`;

    return res.status(201).json({
      ok: true,
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
      deliveryId: delivery.id,
      path: publicPath,
      url: base ? `${base.replace(/\/+$/, "")}${publicPath}` : publicPath,
    });
  },
);

/** DELETE .../secure-documents/:id ?practiceProfileId= */
router.delete("/secure-documents/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = String(req.query.practiceProfileId || "").trim();
  const deliveryId = String(req.params.id || "").trim();
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId || !deliveryId) {
    return res.status(400).json({ ok: false, error: "missing_params" });
  }
  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canManageIntegrations(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const row = await prisma.secureDocumentDelivery.findFirst({
    where: { id: deliveryId, practiceProfileId: practiceId },
  });
  if (!row) return res.status(404).json({ ok: false, error: "not_found" });
  await prisma.secureDocumentDelivery.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "secure_document_delivery_revoked",
    entityType: "SecureDocumentDelivery",
    entityId: row.id,
    metadata: { practiceProfileId: practiceId },
  });
  return res.json({ ok: true });
});

/** GET .../calendar.ics ?practiceProfileId= */
router.get("/previsit-sessions/:sessionId/calendar.ics", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = String(req.query.practiceProfileId || "").trim();
  const sessionId = String(req.params.sessionId || "").trim();
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId || !sessionId) {
    return res.status(400).json({ ok: false, error: "missing_params" });
  }
  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canViewIntegrationSettings(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const session = await prisma.preVisitSession.findFirst({
    where: { id: sessionId, practiceProfileId: practiceId },
    include: { practiceProfile: true },
  });
  if (!session) return res.status(404).json({ ok: false, error: "not_found" });
  if (!session.appointmentAt) {
    return res.status(400).json({
      ok: false,
      error: "appointment_required",
      message: "Appointment date is required for calendar export.",
    });
  }

  const start = new Date(session.appointmentAt);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const uid = `${session.id}@medscoutx.local`;
  const summary = escapeIcsText(
    `MedScoutX Vorbereitung — ${session.practiceProfile?.practiceName || "Praxis"}`,
  );
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MedScoutX//Calendar Export//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDateUtc(new Date())}`,
    `DTSTART:${toIcsDateUtc(start)}`,
    `DTEND:${toIcsDateUtc(end)}`,
    `SUMMARY:${summary}`,
    "DESCRIPTION:Neutraler Terminhinweis ohne medizinische Inhalte.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="medscoutx-preparation-${session.id.slice(0, 8)}.ics"`,
  );
  return res.send(ics);
});

export default router;
