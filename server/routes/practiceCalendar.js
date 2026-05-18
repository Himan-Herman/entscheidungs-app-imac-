/**
 * Practice calendar — appointments, types, availability.
 */

import express from "express";
import { requirePracticeCalendarFeature } from "../middleware/requirePracticeCalendar.js";
import {
  cancelPracticeAppointment,
  createPracticeAppointment,
  getPracticeAppointment,
  listPracticeAppointments,
  patchAppointmentStatus,
  patchPracticeAppointment,
  reschedulePracticeAppointment,
} from "../services/calendar/appointmentService.js";
import {
  archiveAppointmentType,
  createAppointmentType,
  listAppointmentTypes,
  patchAppointmentType,
} from "../services/calendar/appointmentTypeService.js";
import {
  createAvailability,
  deleteAvailability,
  listAvailability,
  patchAvailability,
} from "../services/calendar/availabilityService.js";
import {
  practiceReplyDraft,
  practiceScheduleSummary,
} from "../services/calendar/appointmentAiService.js";

const router = express.Router();
router.use(requirePracticeCalendarFeature);

function uidFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length ? id : null;
}

function practiceIdFromReq(req) {
  const id = req.query?.practiceId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  const forbidden = new Set(["forbidden"]);
  const notFound = new Set([
    "practice_not_found",
    "appointment_not_found",
    "type_not_found",
    "availability_not_found",
    "link_not_found",
  ]);
  const bad = new Set([
    "invalid_time_range",
    "invalid_status",
    "invalid_location_type",
    "invalid_weekday",
    "time_required",
    "name_required",
    "appointment_cancelled",
    "invalid_status_transition",
  ]);
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  if (forbidden.has(msg)) return { status: 403, error: msg };
  if (notFound.has(msg)) return { status: 404, error: msg };
  if (bad.has(msg)) return { status: 400, error: msg };
  return { status: 500, error: "request_failed" };
}

router.get("/appointments", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const appointments = await listPracticeAppointments(uid, pid, req.query);
    return res.json({ ok: true, appointments });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/appointments", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const appointment = await createPracticeAppointment(uid, pid, req.body || {}, { req });
    return res.status(201).json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.get("/appointments/:appointmentId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const appointment = await getPracticeAppointment(uid, pid, req.params.appointmentId);
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/appointments/:appointmentId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const appointment = await patchPracticeAppointment(
      uid,
      pid,
      req.params.appointmentId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/appointments/:appointmentId/cancel", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const appointment = await cancelPracticeAppointment(
      uid,
      pid,
      req.params.appointmentId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/appointments/:appointmentId/reschedule", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const appointment = await reschedulePracticeAppointment(
      uid,
      pid,
      req.params.appointmentId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/appointments/:appointmentId/status", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const appointment = await patchAppointmentStatus(
      uid,
      pid,
      req.params.appointmentId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.get("/appointment-types", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const types = await listAppointmentTypes(uid, pid);
    return res.json({ ok: true, types });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/appointment-types", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const type = await createAppointmentType(uid, pid, req.body || {}, { req });
    return res.status(201).json({ ok: true, type });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/appointment-types/:typeId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const type = await patchAppointmentType(uid, pid, req.params.typeId, req.body || {}, {
      req,
    });
    return res.json({ ok: true, type });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/appointment-types/:typeId/archive", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await archiveAppointmentType(uid, pid, req.params.typeId, { req });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.get("/availability", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const availability = await listAvailability(uid, pid);
    return res.json({ ok: true, availability });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/availability", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const slot = await createAvailability(uid, pid, req.body || {}, { req });
    return res.status(201).json({ ok: true, availability: slot });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.patch("/availability/:availabilityId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const slot = await patchAvailability(uid, pid, req.params.availabilityId, req.body || {}, {
      req,
    });
    return res.json({ ok: true, availability: slot });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.delete("/availability/:availabilityId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await deleteAvailability(uid, pid, req.params.availabilityId, { req });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/ai-schedule-summary", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await practiceScheduleSummary(uid, pid, req.body || {}, { req });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

router.post("/ai-reply-draft", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await practiceReplyDraft(uid, pid, req.body || {}, { req });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
