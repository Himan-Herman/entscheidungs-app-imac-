import express from "express";
import { requireTelemedicineFeature } from "../middleware/requireTelemedicine.js";
import {
  getPatientSession,
  grantPatientConsent,
  listPatientSessions,
  patientJoinWaitingRoom,
  patientLeaveSession,
} from "../services/telemedicine/telemedicineService.js";
const router = express.Router();
router.use(requireTelemedicineFeature);

function uid(req) {
  return req.user?.userId || null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (["forbidden", "consent_required", "link_revoked"].includes(msg)) {
    return { status: 403, error: msg };
  }
  if (msg === "session_not_found") return { status: 404, error: msg };
  return { status: 500, error: "request_failed" };
}

router.get("/", async (req, res) => {
  try {
    const sessions = await listPatientSessions(uid(req));
    return res.json({ ok: true, sessions });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.get("/:sessionId", async (req, res) => {
  try {
    const session = await getPatientSession(uid(req), req.params.sessionId);
    return res.json({ ok: true, session });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/:sessionId/consent", async (req, res) => {
  try {
    const session = await grantPatientConsent(uid(req), req.params.sessionId, { req });
    return res.json({ ok: true, session });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/:sessionId/join", async (req, res) => {
  try {
    const result = await patientJoinWaitingRoom(uid(req), req.params.sessionId, req.body || {}, {
      req,
    });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/:sessionId/leave", async (req, res) => {
  try {
    const session = await patientLeaveSession(uid(req), req.params.sessionId, { req });
    return res.json({ ok: true, session });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
