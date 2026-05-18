/**
 * Patient activity feed — user-friendly timeline (no internal security logs).
 * GET  /api/patient/activity
 * POST /api/patient/activity/ai-summary
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import { listPatientActivity } from "../services/activity/activityFeedService.js";
import { generatePatientActivityAiSummary } from "../services/activity/activityFeedAiService.js";

const router = express.Router();

router.use(requireCareRelationshipFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required") return { status: 400, error: msg };
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  return { status: 500, error: "request_failed" };
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await listPatientActivity(userId, {
      type: req.query.type,
      q: req.query.q,
      from: req.query.from,
      to: req.query.to,
      linkId: req.query.linkId,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/activity]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/ai-summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await generatePatientActivityAiSummary({
      patientUserId: userId,
      locale: req.body?.locale || req.query.locale,
      linkId: req.body?.linkId || req.query.linkId,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/activity/ai-summary]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
