import express from "express";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { canReadPracticePatientLinks } from "../utils/practicePermissions.js";
import {
  getPracticeDashboardSummary,
  listPracticeDashboardRecentActivity,
} from "../services/practiceDashboard/practiceOverviewService.js";
import { generatePracticeDashboardAiSummary } from "../services/practiceDashboard/practiceOverviewAiService.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.get("/summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const summary = await getPracticeDashboardSummary(practiceId, access.role);
    return res.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[practice/dashboard/summary]", e?.message || e);
    return res.status(500).json({ ok: false, error: "summary_failed" });
  }
});

router.get("/recent-activity", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const limit = Number(req.query.limit) || 12;
    const result = await listPracticeDashboardRecentActivity(practiceId, { limit });
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[practice/dashboard/recent-activity]", e?.message || e);
    return res.status(500).json({ ok: false, error: "activity_failed" });
  }
});

router.post("/ai-summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const summary = await getPracticeDashboardSummary(practiceId, access.role);
    const locale = String(req.body?.locale || "de");
    const ai = await generatePracticeDashboardAiSummary({
      locale,
      metrics: summary.metrics,
      visibility: summary.visibility,
    });
    return res.json({
      ok: true,
      summary: ai.text,
      disclaimer: ai.disclaimer,
      aiGenerated: true,
    });
  } catch (e) {
    console.error("[practice/dashboard/ai-summary]", e?.message || e);
    return res.status(500).json({ ok: false, error: "ai_summary_failed" });
  }
});

export default router;
