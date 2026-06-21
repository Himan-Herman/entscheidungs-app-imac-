/**
 * Aggregated practice analytics (owner/admin). No per-patient rows exposed.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import {
  getPracticeAccess,
  canManageIntegrations,
  hasPracticePermission,
  PERMISSIONS,
} from "../utils/practiceAccess.js";
import {
  ANALYTICS_CLIENT_EVENT_TYPES,
  trackAnalyticsEvent,
  sanitizeAnalyticsMetadata,
  summarizePracticeAnalytics,
} from "../services/analyticsService.js";
import { getPracticeAnalyticsOverview } from "../services/practiceAnalyticsOverviewService.js";

const prisma = new PrismaClient();
const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.get("/analytics/summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canManageIntegrations(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const summary = await summarizePracticeAnalytics(practiceId);
    return res.json({ ok: true, summary });
  } catch (err) {
    console.error("[practice/analytics/summary]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/**
 * Aggregated usage / ROI overview (owner / admin / practice_manager).
 * Counts only — no patient data, no medical content. ROI is a labelled estimate.
 */
router.get("/analytics/overview", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access) return res.status(404).json({ ok: false, error: "practice_not_found" });
  if (!hasPracticePermission(access.role, PERMISSIONS.SETTINGS_MANAGE)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const days = req.query.days != null ? Number(req.query.days) : undefined;
    const overview = await getPracticeAnalyticsOverview(practiceId, { days });
    return res.json({ ok: true, ...overview });
  } catch (err) {
    console.error("[practice/analytics/overview]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "overview_failed" });
  }
});

/**
 * Authenticated clients emit UX-safe signals (no medical text). Practice scope resolved server-side.
 */
router.post("/analytics/event", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const body = req.body || {};
  const eventType = String(body.eventType || "").trim();
  if (!eventType || !ANALYTICS_CLIENT_EVENT_TYPES.has(eventType)) {
    return res.status(400).json({ ok: false, error: "invalid_event_type" });
  }

  const qrToken = typeof body.qrToken === "string" ? body.qrToken.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const practiceIdRaw = typeof body.practiceId === "string" ? body.practiceId.trim() : "";

  let practiceId = null;
  let sessionEntityId = null;

  try {
    if (sessionId) {
      const session = await prisma.preVisitSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, practiceProfileId: true },
      });
      if (!session) return res.status(404).json({ ok: false, error: "session_not_found" });
      sessionEntityId = session.id;
      practiceId = session.practiceProfileId || null;
    }

    if (qrToken && !practiceId) {
      const target = await prisma.practiceQrTarget.findUnique({
        where: { qrToken },
        select: { practiceProfileId: true },
      });
      if (target) practiceId = target.practiceProfileId;
    }

    if (practiceIdRaw) {
      const access = await getPracticeAccess(userId, practiceIdRaw);
      if (!access || !canManageIntegrations(access.role)) {
        return res.status(403).json({ ok: false, error: "practice_forbidden" });
      }
      practiceId = practiceIdRaw;
    }

    const meta = sanitizeAnalyticsMetadata(body.metadata) ?? undefined;

    await trackAnalyticsEvent({
      eventType,
      userId,
      practiceId: practiceId || undefined,
      sessionId: sessionEntityId || undefined,
      metadata: meta,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[practice/analytics/event]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
