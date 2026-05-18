/**
 * Patient medication plans — /api/patient/medication-plans (published only)
 */

import express from "express";
import { requireMedicationPlanV2Feature } from "../middleware/requireMedicationPlanV2.js";
import {
  getMedicationPlanForPatient,
  listMedicationPlansForPatient,
} from "../services/medicationPlan/medicationPlanService.js";
import { generatePatientMedicationPlanSimpleLanguage } from "../services/medicationPlan/medicationPlanAiService.js";
import { submitPatientMedicationPlanQuestion } from "../services/medicationPlan/patientMedicationQuestionService.js";
import { writeAuditLog } from "../services/auditLogService.js";

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
  if (msg === "link_not_active") {
    return { status: 409, error: msg };
  }
  if (msg === "ai_not_configured") {
    return { status: 503, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

function medicationPlanAuditMetadata(plan) {
  return {
    practicePatientLinkId: plan.practicePatientLinkId,
    practiceProfileId: plan.practiceProfileId,
    patientUserId: plan.patientUserId,
  };
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

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action: "medication_plan_opened",
      entityType: "medication_plan",
      entityId: plan.id,
      metadata: medicationPlanAuditMetadata(plan),
    });

    return res.json({ ok: true, plan });
  } catch (err) {
    console.error("[patient/medication-plans/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/medication-plans/:planId/question */
router.post("/:planId/question", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await submitPatientMedicationPlanQuestion(
      req.params.planId,
      userId,
    );

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action: "medication_plan_question",
      entityType: "medication_plan",
      entityId: req.params.planId,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/medication-plans/question]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/medication-plans/:planId/ai-simple-language */
router.post("/:planId/ai-simple-language", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const plan = await getMedicationPlanForPatient(req.params.planId, userId);
    const draft = await generatePatientMedicationPlanSimpleLanguage({
      planId: req.params.planId,
      patientUserId: userId,
      locale: req.body?.locale || req.headers["accept-language"],
    });

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action: "medication_plan_ai_simple_language",
      entityType: "medication_plan",
      entityId: plan.id,
      metadata: medicationPlanAuditMetadata(plan),
    });

    return res.json({ ok: true, ...draft });
  } catch (err) {
    console.error("[patient/medication-plans/ai-simple]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
