/**
 * Patient data requests (PR-9).
 * POST /api/patient/data-requests
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import {
  createPatientDataRequest,
  REQUEST_TYPES,
} from "../services/patientDataControl/patientDataRequestService.js";

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
  if (msg === "link_not_found") return { status: 404, error: msg };
  return { status: 500, error: "request_failed" };
}

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

export default router;
