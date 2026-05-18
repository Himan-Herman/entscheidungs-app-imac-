/**
 * Patient medication plans — /api/patient/medication-plans (published only)
 */

import express from "express";
import { requireMedicationPlanV2Feature } from "../middleware/requireMedicationPlanV2.js";
import {
  getMedicationPlanForPatient,
  listMedicationPlansForPatient,
} from "../services/medicationPlan/medicationPlanService.js";

const router = express.Router();

router.use(requireMedicationPlanV2Feature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "plan_not_found") {
    return { status: 404, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/** GET /api/patient/medication-plans */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const plans = await listMedicationPlansForPatient(userId);
    return res.json({ ok: true, plans });
  } catch (err) {
    console.error("[patient/medication-plans/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/patient/medication-plans/:planId */
router.get("/:planId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const plan = await getMedicationPlanForPatient(req.params.planId, userId);
    return res.json({ ok: true, plan });
  } catch (err) {
    console.error("[patient/medication-plans/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
