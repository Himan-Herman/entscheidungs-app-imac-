import express from "express";
import { requirePracticeBookingFeature } from "../middleware/requirePracticeBooking.js";
import {
  getBookingSettings,
  patchBookingSettings,
} from "../services/booking/bookingSettingsService.js";

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

export default router;
