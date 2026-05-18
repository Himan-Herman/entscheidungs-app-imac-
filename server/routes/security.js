/**
 * Practice security & DSGVO overview — owner/admin only.
 * GET /api/security/summary?practiceId=
 * GET /api/security/events?practiceId=
 * POST /api/security/ai-summary
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import { requireSecurityView } from "../utils/securityAccess.js";
import {
  getSecuritySummary,
  listSecurityEvents,
} from "../services/security/securitySummaryService.js";
import { generateSecurityAiSummary } from "../services/security/securityAiSummaryService.js";
import { logSecurityEvent } from "../services/security/securityEventService.js";

const router = express.Router();

router.use(requireCareRelationshipFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err, req, userId, practiceId) {
  const msg = err?.message || "request_failed";
  if (msg === "forbidden") {
    logSecurityEvent({
      req,
      userId,
      actorRole: "practice",
      eventType: "forbidden_api_access",
      practiceProfileId: practiceId,
      metadata: { route: req.path },
    });
    return { status: 403, error: msg };
  }
  if (msg === "validation_required") {
    return { status: 400, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

router.get("/summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  try {
    await requireSecurityView(userId, practiceId);
    const summary = await getSecuritySummary(practiceId);
    return res.json({ ok: true, summary });
  } catch (err) {
    const mapped = mapError(err, req, userId, practiceId);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/events", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  try {
    await requireSecurityView(userId, practiceId);
    const result = await listSecurityEvents(practiceId, {
      limit: req.query.limit,
      from: req.query.from,
      to: req.query.to,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err, req, userId, practiceId);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/ai-summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  try {
    await requireSecurityView(userId, practiceId);
    const explanation = await generateSecurityAiSummary({
      practiceProfileId: practiceId,
      locale: req.body?.locale,
      userId,
      req,
    });
    return res.json({ ok: true, summary: explanation });
  } catch (err) {
    const mapped = mapError(err, req, userId, practiceId);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
