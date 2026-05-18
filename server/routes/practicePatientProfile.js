/**
 * Read-only patient profile for a care link — /api/practice/patients/:linkId/profile
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
} from "../utils/practiceAccess.js";
import { getPatientProfileForPractice } from "../services/careRelationship/practicePatientProfileService.js";
import { generatePracticePatientProfileAiSummary } from "../services/careRelationship/practicePatientProfileAiService.js";

const router = express.Router({ mergeParams: true });

router.use(requireCareRelationshipFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required") return { status: 400, error: msg };
  if (msg === "link_not_found" || msg === "patient_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "profile_access_denied") return { status: 403, error: msg };
  if (msg === "link_not_active") return { status: 409, error: msg };
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  return { status: 500, error: "request_failed" };
}

/** GET /api/practice/patients/:linkId/profile */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const profile = await getPatientProfileForPractice(
      req.params.linkId,
      practiceId,
      userId,
    );
    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("[practice/patients/profile]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/profile/ai-summary */
router.post("/ai-summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const locale = String(req.body?.locale || req.query.locale || "de").trim();

  try {
    const result = await generatePracticePatientProfileAiSummary({
      linkId: req.params.linkId,
      practiceProfileId: practiceId,
      viewerUserId: userId,
      locale,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/patients/profile/ai-summary]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
