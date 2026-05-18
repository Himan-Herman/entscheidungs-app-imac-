/**
 * Practice internal audit log (compliance) — includes security events.
 * GET /api/practice/audit?practiceId=
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import { getPracticeAccess, hasPracticePermission, PERMISSIONS } from "../utils/practiceAccess.js";
import { listPracticeAuditLog } from "../services/activity/activityFeedService.js";

const router = express.Router();

router.use(requireCareRelationshipFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !hasPracticePermission(access.role, PERMISSIONS.AUDIT_VIEW)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const result = await listPracticeAuditLog(practiceId, {
      severity: req.query.severity,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/audit]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
