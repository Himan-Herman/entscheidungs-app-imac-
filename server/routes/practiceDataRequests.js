/**
 * Practice view of patient data requests.
 * GET   /api/practice/data-requests?practiceId=
 * GET   /api/practice/data-requests/:requestId?practiceId=
 * PATCH /api/practice/data-requests/:requestId/status?practiceId=
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canWritePracticePatientLinks,
} from "../utils/practiceAccess.js";
import {
  getPracticeDataRequest,
  listPracticeDataRequests,
  updatePracticeDataRequestStatus,
  REQUEST_STATUSES,
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
  if (msg === "validation_invalid_status") return { status: 400, error: msg };
  if (msg === "request_not_found") return { status: 404, error: msg };
  if (msg === "forbidden") return { status: 403, error: msg };
  // Deletion requests cannot be marked completed without a real erasure (honesty guard).
  if (msg === "deletion_requires_manual_erasure") return { status: 409, error: msg };
  return { status: 500, error: "request_failed" };
}

async function assertPracticeRead(userId, practiceId) {
  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return null;
  }
  return access;
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  const access = await assertPracticeRead(userId, practiceId);
  if (!access) return res.status(403).json({ ok: false, error: "forbidden" });

  try {
    const requests = await listPracticeDataRequests(practiceId);
    return res.json({ ok: true, requests });
  } catch (err) {
    console.error("[practice/data-requests]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/:requestId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  const access = await assertPracticeRead(userId, practiceId);
  if (!access) return res.status(403).json({ ok: false, error: "forbidden" });

  try {
    const request = await getPracticeDataRequest(
      req.params.requestId,
      practiceId,
      userId,
    );
    return res.json({ ok: true, request });
  } catch (err) {
    console.error("[practice/data-requests/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.patch("/:requestId/status", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || req.body?.practiceId || "").trim();
  const status = String(req.body?.status || "").trim();
  if (!practiceId || !status) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }
  if (!REQUEST_STATUSES.has(status)) {
    return res.status(400).json({ ok: false, error: "validation_invalid_status" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const request = await updatePracticeDataRequestStatus({
      requestId: req.params.requestId,
      practiceProfileId: practiceId,
      handlerUserId: userId,
      status,
      responseNote: req.body?.responseNote,
    });
    return res.json({ ok: true, request });
  } catch (err) {
    console.error("[practice/data-requests/status]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
