/**
 * Patient profile sharing overview — alias for data-control practice links.
 * GET /api/patient/profile-sharing
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import { getPatientDataControl } from "../services/patientDataControl/patientDataControlService.js";

const router = express.Router();

router.use(requireCareRelationshipFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** GET /api/patient/profile-sharing */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const practices = await getPatientDataControl(userId);
    return res.json({ ok: true, practices });
  } catch (err) {
    console.error("[patient/profile-sharing]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
