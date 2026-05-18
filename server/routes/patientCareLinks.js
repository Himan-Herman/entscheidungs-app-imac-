/**
 * Patient ↔ practice care links (Phase 1 — PR-2).
 * Routes mounted at /api/patient/links
 * Requires CARE_RELATIONSHIP_ENABLED=true.
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import {
  acceptPracticePatientLinkConsent,
  getPatientCareLink,
  listPatientCareLinks,
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
  if (msg === "validation_required") return { status: 400, error: msg };
  if (msg === "validation_invalid_consent_version") {
    return { status: 400, error: msg };
  }
  if (msg === "validation_consent_scopes_required") {
    return { status: 400, error: msg };
  }
  if (msg === "link_not_found") return { status: 404, error: msg };
  if (msg === "link_not_active") return { status: 409, error: msg };
  return { status: 500, error: "request_failed" };
}

/** GET /api/patient/links?status=&limit=&offset= */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const status = String(req.query.status || "").trim();
  if (status && !LINK_STATUSES.has(status)) {
    return res.status(400).json({ ok: false, error: "validation_invalid_status" });
  }

  try {
    const result = await listPatientCareLinks(userId, {
      status: status || undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/links/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/patient/links/:linkId */
router.get("/:linkId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const link = await getPatientCareLink(req.params.linkId, userId);
    return res.json({ ok: true, link });
  } catch (err) {
    console.error("[patient/links/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/links/:linkId/consent */
router.post("/:linkId/consent", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const link = await acceptPracticePatientLinkConsent({
      linkId: req.params.linkId,
      patientUserId: userId,
      consentVersion: req.body?.consentVersion,
      scopes: req.body?.scopes,
    });

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action: "practice_patient_link_consent_accepted",
      entityType: "PracticePatientLink",
      entityId: link.id,
      metadata: {
        consentVersion: link.consentVersion,
        scopeCount: Array.isArray(link.consentScopes) ? link.consentScopes.length : 0,
      },
    });

    return res.json({ ok: true, link });
  } catch (err) {
    console.error("[patient/links/consent]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
