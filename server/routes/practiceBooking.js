import express from "express";
import { requirePracticeBookingFeature } from "../middleware/requirePracticeBooking.js";
import {
  getBookingSettings,
  patchBookingSettings,
} from "../services/booking/bookingSettingsService.js";
import {
  listBookingRequests,
  acceptBookingRequest,
  declineBookingRequest,
} from "../services/booking/bookingRequestsService.js";

const router = express.Router();
router.use(requirePracticeBookingFeature);

function uid(req) {
  return req.user?.userId || null;
}

function pid(req) {
  const id = req.query?.practiceId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  switch (msg) {
    case "forbidden":
      return { status: 403, error: "forbidden" };
    case "practice_not_found":
      return { status: 404, error: "practice_not_found" };
    case "appointment_not_found":
      return { status: 404, error: "appointment_not_found" };
    case "not_a_request":
      return { status: 422, error: "not_a_request" };
    case "invalid_time_range":
      return { status: 422, error: "invalid_time_range" };
    case "invalid_status":
      return { status: 422, error: "invalid_status" };
    case "invalid_location_type":
      return { status: 422, error: "invalid_location_type" };
    case "booking_mode_invalid":
    case "booking_mode_conflict":
    case "anamnesis_link_not_found":
    case "anamnesis_link_inactive":
    case "anamnesis_link_expired":
      return { status: 422, error: msg };
    default:
      return { status: 500, error: "request_failed" };
  }
}

/** GET /api/practice/booking/settings?practiceId=... */
router.get("/settings", async (req, res) => {
  try {
    const settings = await getBookingSettings(uid(req), pid(req));
    return res.json({ ok: true, settings });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** PATCH /api/practice/booking/settings?practiceId=... */
router.patch("/settings", async (req, res) => {
  try {
    const settings = await patchBookingSettings(uid(req), pid(req), req.body || {}, { req });
    return res.json({ ok: true, settings });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** GET /api/practice/booking/requests?practiceId=...&status=...&from=...&to=... */
router.get("/requests", async (req, res) => {
  try {
    const result = await listBookingRequests(uid(req), pid(req), {
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      appointmentTypeId: req.query.appointmentTypeId,
    });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** PATCH /api/practice/booking/requests/:id/accept?practiceId=... */
router.patch("/requests/:id/accept", async (req, res) => {
  try {
    const appointment = await acceptBookingRequest(
      uid(req),
      pid(req),
      req.params.id,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** PATCH /api/practice/booking/requests/:id/decline?practiceId=... */
router.patch("/requests/:id/decline", async (req, res) => {
  try {
    const appointment = await declineBookingRequest(
      uid(req),
      pid(req),
      req.params.id,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, appointment });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
