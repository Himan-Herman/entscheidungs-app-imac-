/**
 * Patient video consultations INSIDE one care relationship —
 * /api/patient/practice/:linkId/telemedicine
 *
 * Distinct from routes/patientTelemedicine.js, the cross-practice list
 * (`/api/patient/telemedicine`). Same table; only the scope differs.
 *
 * WHAT MAY APPEAR HERE
 * --------------------
 * Sessions whose `practicePatientLinkId` is exactly this link and whose patient
 * is this link's patient. `practicePatientLinkId` is nullable and legitimately
 * so, therefore a session that names a practice but no relationship does NOT
 * appear — it stays reachable through the cross-practice page.
 *
 * JOINING IS NOT LISTING
 * ----------------------
 * The join endpoint re-derives authorization: link ownership, the session
 * belonging to this link, patient consent, and the link not being revoked. The
 * meeting URL is issued there and only there.
 */

import express from "express";
import { isTelemedicineUiEnabled } from "../config/featureFlags.js";
import {
  getPatientLinkSession,
  grantPatientLinkConsent,
  joinPatientLinkSession,
  leavePatientLinkSession,
  listPatientLinkSessions,
} from "../services/telemedicine/telemedicineContextService.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router({ mergeParams: true });

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isTelemedicineUiEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required") return { status: 400, error: msg };
  // A foreign link, a foreign session and a missing one are all "not found".
  if (msg === "link_not_found" || msg === "session_not_found") {
    return { status: 404, error: "not_found" };
  }
  if (msg === "consent_required") return { status: 403, error: msg };
  if (msg === "link_revoked") return { status: 409, error: msg };
  return { status: 500, error: "request_failed" };
}

/** GET / — consultations of this care relationship */
router.get("/", requireFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const sessions = await listPatientLinkSessions(req.params.linkId, userId);
    return res.json({ ok: true, sessions });
  } catch (err) {
    logServerError("patient/practice/telemedicine/list", err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** GET /:sessionId */
router.get("/:sessionId", requireFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const session = await getPatientLinkSession(req.params.linkId, req.params.sessionId, userId);
    return res.json({ ok: true, session });
  } catch (err) {
    logServerError("patient/practice/telemedicine/get", err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** POST /:sessionId/consent — the patient's existing right, link-scoped. */
router.post("/:sessionId/consent", requireFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await grantPatientLinkConsent(
      req.params.linkId,
      req.params.sessionId,
      userId,
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    logServerError("patient/practice/telemedicine/consent", err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/**
 * PATCH /:sessionId/join — enters the waiting room and issues the meeting URL.
 *
 * The only place a join URL is handed out. Everything the list shows can be
 * stale; this call decides again.
 */
router.patch("/:sessionId/join", requireFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await joinPatientLinkSession(
      req.params.linkId,
      req.params.sessionId,
      userId,
      { req, body: req.body || {} },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    logServerError("patient/practice/telemedicine/join", err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** PATCH /:sessionId/leave */
router.patch("/:sessionId/leave", requireFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const session = await leavePatientLinkSession(
      req.params.linkId,
      req.params.sessionId,
      userId,
      { req },
    );
    return res.json({ ok: true, session });
  } catch (err) {
    logServerError("patient/practice/telemedicine/leave", err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
