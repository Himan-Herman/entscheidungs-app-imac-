/**
 * Patient-facing practice organization (doctor selection, public doctors).
 * GET  /api/patient/practices/:practiceId/doctors
 * POST /api/patient/practices/:practiceId/select-doctor
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import { listPublicPracticeDoctors } from "../services/practiceTeam/practiceDoctorsService.js";
import { patientSelectPracticeDoctor } from "../services/careRelationship/practicePatientAssignmentService.js";

const router = express.Router();

router.use(requireCareRelationshipFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** GET /api/patient/practices/:practiceId/doctors */
router.get("/:practiceId/doctors", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const data = await listPublicPracticeDoctors(req.params.practiceId);
    return res.json({ ok: true, ...data });
  } catch (err) {
    if (err?.message === "practice_not_found") {
      return res.status(404).json({ ok: false, error: err.message });
    }
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST /api/patient/practices/:practiceId/select-doctor */
router.post("/:practiceId/select-doctor", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const link = await patientSelectPracticeDoctor(userId, req.params.practiceId, {
      doctorUserId: req.body?.doctorUserId ?? null,
    });
    return res.json({ ok: true, link });
  } catch (err) {
    const msg = err?.message;
    if (msg === "link_not_found") return res.status(404).json({ ok: false, error: msg });
    if (msg === "doctor_not_available") return res.status(400).json({ ok: false, error: msg });
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
