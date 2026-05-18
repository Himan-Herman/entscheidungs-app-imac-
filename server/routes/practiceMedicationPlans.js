/**
 * Practice medication plans on a care link — /api/practice/patients/:linkId/medication-plans
 */

import express from "express";
import { requireMedicationPlanV2Feature } from "../middleware/requireMedicationPlanV2.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canWritePracticePatientLinks,
} from "../utils/practiceAccess.js";
import {
  archiveMedicationPlan,
  createDraftMedicationPlan,
  deleteMedicationPlan,
  getMedicationPlanByLink,
  listMedicationPlansForPracticePatient,
  publishMedicationPlan,
  updateDraftMedicationPlan,
} from "../services/medicationPlan/medicationPlanService.js";
import { generatePracticeMedicationPlanAiFormat } from "../services/medicationPlan/medicationPlanAiService.js";
import { writeAuditLog } from "../services/auditLogService.js";

function medicationPlanAuditMetadata(plan) {
  return {
    practicePatientLinkId: plan.practicePatientLinkId,
    practiceProfileId: plan.practiceProfileId,
    patientUserId: plan.patientUserId,
  };
}

const router = express.Router({ mergeParams: true });

router.use(requireMedicationPlanV2Feature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function practiceIdFromReq(req) {
  return String(req.query.practiceId || req.body?.practiceId || "").trim();
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (
    msg === "validation_required" ||
    msg === "validation_text_too_long" ||
    msg === "validation_too_many_items" ||
    msg === "validation_invalid_date"
  ) {
    return { status: 400, error: msg };
  }
  if (msg === "link_not_found" || msg === "plan_not_found") {
    return { status: 404, error: msg };
  }
  if (
    msg === "link_not_active" ||
    msg === "plan_not_editable" ||
    msg === "plan_not_publishable" ||
    msg === "plan_already_archived"
  ) {
    return { status: 409, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

async function requirePracticeAccess(req) {
  const userId = userIdFromReq(req);
  if (!userId) return { error: { status: 401, body: { ok: false, error: "unauthorized" } } };

  const practiceId = practiceIdFromReq(req);
  if (!practiceId) {
    return {
      error: {
        status: 400,
        body: { ok: false, error: "validation_required" },
      },
    };
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access) {
    return { error: { status: 403, body: { ok: false, error: "forbidden" } } };
  }

  return { userId, practiceId, access };
}

/** GET /api/practice/patients/:linkId/medication-plans */
router.get("/", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canReadPracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const plans = await listMedicationPlansForPracticePatient(
      req.params.linkId,
      ctx.practiceId,
    );
    return res.json({ ok: true, plans });
  } catch (err) {
    console.error("[practice/medication-plans/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/medication-plans */
router.post("/", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const plan = await createDraftMedicationPlan(
      req.params.linkId,
      ctx.practiceId,
      ctx.userId,
      {
        title: req.body?.title,
        note: req.body?.note,
        items: req.body?.items,
      },
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "medication_plan_created",
      entityType: "medication_plan",
      entityId: plan.id,
      metadata: medicationPlanAuditMetadata(plan),
    });

    return res.status(201).json({ ok: true, plan });
  } catch (err) {
    console.error("[practice/medication-plans/create]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patients/:linkId/medication-plans/:planId */
router.get("/:planId", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canReadPracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const plan = await getMedicationPlanByLink(
      req.params.linkId,
      ctx.practiceId,
      req.params.planId,
    );
    return res.json({ ok: true, plan });
  } catch (err) {
    console.error("[practice/medication-plans/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PUT /api/practice/patients/:linkId/medication-plans/:planId */
router.put("/:planId", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const plan = await updateDraftMedicationPlan(
      req.params.planId,
      req.params.linkId,
      ctx.practiceId,
      {
        title: req.body?.title,
        note: req.body?.note,
        items: req.body?.items,
      },
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "medication_plan_updated",
      entityType: "medication_plan",
      entityId: plan.id,
      metadata: medicationPlanAuditMetadata(plan),
    });

    return res.json({ ok: true, plan });
  } catch (err) {
    console.error("[practice/medication-plans/update]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/medication-plans/:planId/publish */
router.post("/:planId/publish", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const plan = await publishMedicationPlan(
      req.params.planId,
      req.params.linkId,
      ctx.practiceId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "medication_plan_published",
      entityType: "medication_plan",
      entityId: plan.id,
      metadata: medicationPlanAuditMetadata(plan),
    });

    return res.json({ ok: true, plan });
  } catch (err) {
    console.error("[practice/medication-plans/publish]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/patients/:linkId/medication-plans/:planId/archive */
router.patch("/:planId/archive", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const plan = await archiveMedicationPlan(
      req.params.planId,
      req.params.linkId,
      ctx.practiceId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "medication_plan_archived",
      entityType: "medication_plan",
      entityId: plan.id,
      metadata: medicationPlanAuditMetadata(plan),
    });

    return res.json({ ok: true, plan });
  } catch (err) {
    console.error("[practice/medication-plans/archive]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/patients/:linkId/medication-plans/:planId/delete */
router.patch("/:planId/delete", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const plan = await deleteMedicationPlan(
      req.params.planId,
      req.params.linkId,
      ctx.practiceId,
      ctx.userId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "medication_plan_deleted",
      entityType: "medication_plan",
      entityId: plan.id,
      metadata: medicationPlanAuditMetadata(plan),
    });

    return res.json({ ok: true, plan });
  } catch (err) {
    console.error("[practice/medication-plans/delete]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/medication-plans/:planId/ai-format */
router.post("/:planId/ai-format", async (req, res) => {
  const ctx = await requirePracticeAccess(req);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canWritePracticePatientLinks(ctx.access)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const draft = await generatePracticeMedicationPlanAiFormat({
      linkId: req.params.linkId,
      practiceProfileId: ctx.practiceId,
      planId: req.params.planId,
      locale: req.body?.locale || req.headers["accept-language"],
    });

    const plan = await getMedicationPlanByLink(
      req.params.planId,
      ctx.practiceId,
      req.params.linkId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "medication_plan_ai_format",
      entityType: "medication_plan",
      entityId: req.params.planId,
      metadata: medicationPlanAuditMetadata(plan),
    });

    return res.json({ ok: true, ...draft });
  } catch (err) {
    console.error("[practice/medication-plans/ai-format]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
