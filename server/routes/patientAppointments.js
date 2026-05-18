/**
 * Patient appointments — own calendar entries only.
 */

import express from "express";
import { requirePracticeCalendarFeature } from "../middleware/requirePracticeCalendar.js";
import {
  confirmPatientAppointment,
  getPatientAppointment,
  listPatientAppointments,
  patientCancelRequest,
  requestPatientAppointment,
} from "../services/calendar/appointmentService.js";
import { patientRequestDraft } from "../services/calendar/appointmentAiService.js";

const router = express.Router();
router.use(requirePracticeCalendarFeature);

function uidFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  if (msg === "link_not_found" || msg === "appointment_not_found") {
    return { status: 404, error: msg };
  }
  if (
    [
      "practiceId_required",
      "invalid_status_transition",
      "appointment_cancelled",
    ].includes(msg)
  ) {
    return { status: 400, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

router.get("/", async (req, res) => {
  const uid = uidFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const appointments = await listPatientAppointments(uid);
    return res.json({ ok: true, appointments });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/request", async (req, res) => {
  const uid = uidFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const appointment = await requestPatientAppointment(uid, req.body || {}, { req });
    return res.status(201).json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.get("/:appointmentId", async (req, res) => {
  const uid = uidFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const appointment = await getPatientAppointment(uid, req.params.appointmentId);
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/:appointmentId/confirm", async (req, res) => {
  const uid = uidFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const appointment = await confirmPatientAppointment(uid, req.params.appointmentId, {
      req,
    });
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/:appointmentId/cancel-request", async (req, res) => {
  const uid = uidFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const appointment = await patientCancelRequest(uid, req.params.appointmentId, req.body || {}, {
      req,
    });
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/ai-request-draft", async (req, res) => {
  const uid = uidFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const result = await patientRequestDraft(uid, req.body || {}, { req });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
