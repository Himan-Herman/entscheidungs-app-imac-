import express from "express";
import {
  grantConsentRecord,
  listPatientConsents,
  revokeConsentRecord,
} from "../services/consent/consentRecordService.js";
import { generateConsentAiExplanation } from "../services/consent/consentAiExplanationService.js";
import { CONSENT_TYPES } from "../services/consent/consentTypes.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (
    msg === "validation_required" ||
    msg === "validation_invalid_date" ||
    msg === "link_not_active"
  ) {
    return { status: 400, error: msg };
  }
  if (msg === "link_not_found" || msg === "consent_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "consent_required") {
    return { status: 403, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/** GET /api/patient/consents */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const consents = await listPatientConsents(userId);
    return res.json({ ok: true, consents, consentTypes: CONSENT_TYPES });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/consents */
router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const consent = await grantConsentRecord({
      patientUserId: userId,
      practicePatientLinkId: req.body?.practicePatientLinkId,
      consentType: req.body?.consentType,
      expiresAt: req.body?.expiresAt,
      req,
    });
    return res.status(201).json({ ok: true, consent });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/patient/consents/:consentId/revoke */
router.patch("/:consentId/revoke", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const consent = await revokeConsentRecord(req.params.consentId, userId, { req });
    return res.json({ ok: true, consent });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/consents/:consentId/ai-explanation */
router.post("/:consentId/ai-explanation", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const explanation = await generateConsentAiExplanation({
      consentId: req.params.consentId,
      patientUserId: userId,
      locale: req.body?.locale || req.headers["accept-language"],
      req,
    });
    return res.json({ ok: true, explanation });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
