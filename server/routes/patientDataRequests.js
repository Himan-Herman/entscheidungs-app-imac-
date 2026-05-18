/**
 * Patient data requests.
 * POST /api/patient/data-requests
 * GET  /api/patient/data-requests
 * POST /api/patient/data-requests/ai-draft
 * POST /api/patient/data-requests/:requestId/ai-summary
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import {
  createPatientDataRequest,
  listPatientDataRequests,
  REQUEST_TYPES,
} from "../services/patientDataControl/patientDataRequestService.js";
import {
  generatePatientDataRequestAiDraft,
  generatePatientDataRequestAiSummary,
} from "../services/patientDataControl/patientDataRequestAiService.js";

const router = express.Router();

router.use(requireCareRelationshipFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required") return { status: 400, error: msg };
  if (msg === "validation_invalid_type") return { status: 400, error: msg };
  if (msg === "link_not_found" || msg === "request_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "request_already_open") return { status: 409, error: msg };
  if (msg === "forbidden") return { status: 403, error: msg };
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  return { status: 500, error: "request_failed" };
}

/** GET /api/patient/data-requests */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const requests = await listPatientDataRequests(userId);
    return res.json({ ok: true, requests });
  } catch (err) {
    console.error("[patient/data-requests/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/data-requests/ai-draft */
router.post("/ai-draft", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const type = String(req.body?.type || "deletion").trim();
  if (!REQUEST_TYPES.has(type)) {
    return res.status(400).json({ ok: false, error: "validation_invalid_type" });
  }

  try {
    const result = await generatePatientDataRequestAiDraft({
      type,
      locale: req.body?.locale,
      practiceName: req.body?.practiceName,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/data-requests/ai-draft]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const type = String(req.body?.type || "deletion").trim();
  if (!REQUEST_TYPES.has(type)) {
    return res.status(400).json({ ok: false, error: "validation_invalid_type" });
  }

  const linkId = req.body?.practicePatientLinkId || req.body?.linkId;
  if (!linkId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  try {
    const request = await createPatientDataRequest({
      patientUserId: userId,
      practicePatientLinkId: String(linkId).trim(),
      type,
      reason: req.body?.reason,
    });
    return res.status(201).json({ ok: true, request });
  } catch (err) {
    console.error("[patient/data-requests]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/data-requests/:requestId/ai-summary */
router.post("/:requestId/ai-summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await generatePatientDataRequestAiSummary({
      requestId: req.params.requestId,
      patientUserId: userId,
      locale: req.body?.locale,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/data-requests/ai-summary]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
