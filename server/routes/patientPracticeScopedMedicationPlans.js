/**
 * Patient medication plans INSIDE one care relationship —
 * /api/patient/practice/:linkId/medication-plans
 *
 * Distinct from routes/patientMedicationPlans.js, which is the older
 * cross-practice list (`/api/patient/medication-plans`). Both read the same
 * table; only the scope differs, and that difference is the point.
 *
 * WHAT MAY APPEAR HERE
 * --------------------
 * Published plans whose `practicePatientLinkId` is exactly this link. Nothing
 * else: not a plan of another link, not a plan of the same practice under a
 * different link, not a draft, not an archived or deleted plan, and not a plan
 * that merely belongs to the same patient account.
 *
 * The name is plural because the model permits several published plans per
 * link — publishing does not archive its predecessor.
 *
 * AUTHORIZATION
 * -------------
 * Session user + linkId from the path. No practiceId, patientId or planId is
 * accepted as proof of anything; the scope lives in the database query.
 *
 * NO AI HERE
 * ----------
 * The cross-practice detail page offers an assisted plain-language draft. That
 * function is deliberately NOT part of this context route (Phase 2E.3 is a data
 * and context migration), and no medication content leaves the system here.
 */

import express from "express";
import { requireMedicationPlanV2Feature } from "../middleware/requireMedicationPlanV2.js";
import {
  getPatientLinkMedicationPlan,
  listPatientLinkMedicationPlans,
  submitPatientLinkMedicationPlanQuestion,
} from "../services/medicationPlan/medicationPlanService.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router({ mergeParams: true });

router.use(requireMedicationPlanV2Feature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required") return { status: 400, error: msg };
  // A foreign link, a foreign plan and a missing one are all "not found".
  if (msg === "link_not_found" || msg === "plan_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "link_not_active") return { status: 409, error: msg };
  return { status: 500, error: "request_failed" };
}

/**
 * Audit metadata keeps the existing shape of the cross-practice route so the
 * two paths stay comparable in the log. No medication content is recorded.
 */
function auditMetadata(linkId) {
  return { practicePatientLinkId: linkId };
}

/** GET / — published plans of this care relationship */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const plans = await listPatientLinkMedicationPlans(req.params.linkId, userId);
    return res.json({ ok: true, plans });
  } catch (err) {
    console.error("[patient/practice/medication-plans/list]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** GET /:planId */
router.get("/:planId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { json } = await getPatientLinkMedicationPlan(
      req.params.linkId,
      req.params.planId,
      userId,
    );

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "medication_plan_opened",
      entityType: "medication_plan",
      entityId: json.id,
      metadata: auditMetadata(req.params.linkId),
    });

    return res.json({ ok: true, plan: json });
  } catch (err) {
    console.error("[patient/practice/medication-plans/get]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/**
 * POST /:planId/question — the same right the cross-practice page grants.
 *
 * Only the fact of the question reaches the practice inbox; the text is not
 * stored in the inbox entry or in the audit metadata.
 */
router.post("/:planId/question", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await submitPatientLinkMedicationPlanQuestion(
      req.params.linkId,
      req.params.planId,
      userId,
    );

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "medication_plan_question_submitted",
      entityType: "medication_plan",
      entityId: result.planId,
      metadata: auditMetadata(req.params.linkId),
    });

    return res.status(201).json({ ok: true, planId: result.planId });
  } catch (err) {
    console.error("[patient/practice/medication-plans/question]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
