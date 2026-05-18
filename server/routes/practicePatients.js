/**
 * Practice ↔ patient care relationships (Phase 1 — PR-1/2).
 * Routes mounted at /api/practice/patients
 * Requires CARE_RELATIONSHIP_ENABLED=true.
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canWritePracticePatientLinks,
} from "../utils/practiceAccess.js";
import {
  createPracticePatientLink,
  listPracticePatientLinks,
  getPracticePatientLink,
  updatePracticePatientLinkStatus,
  LINK_STATUSES,
} from "../services/careRelationship/practicePatientLinkService.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

router.use(requireCareRelationshipFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required" || msg === "practiceId_required") {
    return { status: 400, error: msg };
  }
  if (msg === "validation_invalid_status" || msg === "validation_invalid_consent_version") {
    return { status: 400, error: msg };
  }
  if (msg === "validation_consent_scopes_required") {
    return { status: 400, error: msg };
  }
  if (msg === "link_not_active") {
    return { status: 409, error: msg };
  }
  if (msg === "link_already_exists") {
    return { status: 409, error: msg };
  }
  if (
    msg === "link_not_found" ||
    msg === "practice_not_found" ||
    msg === "patient_user_not_found" ||
    msg === "patient_profile_not_found"
  ) {
    return { status: 404, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/** GET /api/practice/patients?practiceId=&status=&limit=&offset= */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const status = String(req.query.status || "").trim();
  if (status && !LINK_STATUSES.has(status)) {
    return res.status(400).json({ ok: false, error: "validation_invalid_status" });
  }

  try {
    const result = await listPracticePatientLinks(practiceId, {
      status: status || undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({
      ok: true,
      role: access.role,
      practiceId,
      ...result,
    });
  } catch (err) {
    console.error("[practice/patients/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/link */
router.post("/link", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const link = await createPracticePatientLink({
      practiceProfileId: practiceId,
      patientUserId: req.body?.patientUserId,
      patientProfileId: req.body?.patientProfileId,
      status: req.body?.status,
    });

    await writeAuditLog({
      userId,
      actorRole: access.role,
      action: "practice_patient_link_created",
      entityType: "PracticePatientLink",
      entityId: link.id,
      metadata: { status: link.status },
    });

    return res.status(201).json({ ok: true, link });
  } catch (err) {
    console.error("[practice/patients/link]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patients/:linkId?practiceId= */
router.get("/:linkId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const link = await getPracticePatientLink(req.params.linkId, practiceId);
    return res.json({ ok: true, role: access.role, link });
  } catch (err) {
    console.error("[practice/patients/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/patients/:linkId/status */
router.patch("/:linkId/status", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const status = String(req.body?.status || "").trim();
  if (!status) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  try {
    const link = await updatePracticePatientLinkStatus(
      req.params.linkId,
      practiceId,
      status,
    );

    await writeAuditLog({
      userId,
      actorRole: access.role,
      action: "practice_patient_link_status_updated",
      entityType: "PracticePatientLink",
      entityId: link.id,
      metadata: { status: link.status },
    });

    return res.json({ ok: true, link });
  } catch (err) {
    console.error("[practice/patients/status]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
