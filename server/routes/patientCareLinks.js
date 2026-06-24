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
import { updatePatientProfileAccess } from "../services/careRelationship/practicePatientProfileService.js";
import { archiveLinkForPatient } from "../services/careRelationship/patientLinkArchiveService.js";
import {
  createConnectCode,
  getActiveConnectCode,
  revokeConnectCode,
} from "../services/careRelationship/connectCodeService.js";
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
  if (msg === "link_already_archived") return { status: 409, error: msg };
  if (msg === "connect_code_not_found") return { status: 404, error: msg };
  if (msg === "connect_code_not_active") return { status: 409, error: msg };
  return { status: 500, error: "request_failed" };
}

// --- Patient-generated practice connection code (Phase 1) ---
// Registered before the "/:linkId" routes so the literal path is not captured.

/** POST /api/patient/links/connect-code — generate a fresh code (body: { scopes: string[] }). */
router.post("/connect-code", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const result = await createConnectCode({ patientUserId: userId, scopes: req.body?.scopes });
    await writeAuditLog({
      userId,
      action: "patient_connect_code_created",
      entityType: "PatientPracticeConnectCode",
      entityId: result.id,
      metadata: { scopeCount: result.consentScopes.length },
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/links/connect-code/create]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/patient/links/connect-code — metadata for the active code (never the plaintext). */
router.get("/connect-code", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const code = await getActiveConnectCode(userId);
    return res.json({ ok: true, code });
  } catch (err) {
    console.error("[patient/links/connect-code/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** DELETE /api/patient/links/connect-code/:id — revoke an active code. */
router.delete("/connect-code/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const code = await revokeConnectCode({ patientUserId: userId, codeId: req.params.id });
    await writeAuditLog({
      userId,
      action: "patient_connect_code_revoked",
      entityType: "PatientPracticeConnectCode",
      entityId: code.id,
    });
    return res.json({ ok: true, code });
  } catch (err) {
    console.error("[patient/links/connect-code/revoke]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

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

/** PATCH /api/patient/links/:linkId/archive */
router.patch("/:linkId/archive", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const link = await archiveLinkForPatient(req.params.linkId, userId);
    return res.json({ ok: true, link });
  } catch (err) {
    console.error("[patient/links/archive]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/patient/links/:linkId/profile-access */
router.patch("/:linkId/profile-access", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const granted = req.body?.granted;
  if (typeof granted !== "boolean") {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  try {
    const link = await updatePatientProfileAccess(
      req.params.linkId,
      userId,
      granted,
    );
    return res.json({ ok: true, link });
  } catch (err) {
    console.error("[patient/links/profile-access]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
