/**
 * Practice view of patient data requests (PR-9).
 * GET /api/practice/data-requests?practiceId=
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
} from "../utils/practiceAccess.js";
import { listPracticeDataRequests } from "../services/patientDataControl/patientDataRequestService.js";

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
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const requests = await listPracticeDataRequests(practiceId);
    return res.json({ ok: true, requests });
  } catch (err) {
    console.error("[practice/data-requests]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
