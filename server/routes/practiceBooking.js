import express from "express";
import { requirePracticeBookingFeature } from "../middleware/requirePracticeBooking.js";
import { bookingAssistLimiter } from "../middleware/ipRateLimit.js";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { canManageCalendar } from "../utils/practicePermissions.js";
import {
  getBookingSettings,
  patchBookingSettings,
} from "../services/booking/bookingSettingsService.js";
import {
  listBookingRequests,
  acceptBookingRequest,
  declineBookingRequest,
} from "../services/booking/bookingRequestsService.js";
import { runAppointmentAssistant } from "../services/booking/appointmentRequestAssistantService.js";

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
  if (err?.status === 400) return { status: 400, error: msg };
  switch (msg) {
    case "forbidden":
      return { status: 403, error: "forbidden" };
    case "practice_not_found":
    case "appointment_not_found":
      return { status: 404, error: msg };
    case "unsupported_action":
    case "missing_required_params":
      return { status: 400, error: msg };
    case "booking_mode_invalid":
    case "booking_mode_conflict":
    case "anamnesis_link_not_found":
    case "anamnesis_link_inactive":
    case "anamnesis_link_expired":
    case "not_a_request":
    case "invalid_status":
    case "invalid_time_range":
    case "invalid_location_type":
    case "time_slot_conflict":
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
    const result = await listBookingRequests(uid(req), pid(req), req.query);
    return res.json({ ok: true, ...result });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** PATCH /api/practice/booking/requests/:appointmentId/accept?practiceId=... */
router.patch("/requests/:appointmentId/accept", async (req, res) => {
  try {
    const appt = await acceptBookingRequest(
      uid(req),
      pid(req),
      req.params.appointmentId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, appointment: appt });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** PATCH /api/practice/booking/requests/:appointmentId/decline?practiceId=... */
router.patch("/requests/:appointmentId/decline", async (req, res) => {
  try {
    const appt = await declineBookingRequest(
      uid(req),
      pid(req),
      req.params.appointmentId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, appointment: appt });
  } catch (e) {
    const m = mapError(e);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/**
 * POST /api/practice/booking/appointments/:appointmentId/assist?practiceId=...
 *
 * Runs the organisational AI assistant for an open booking request.
 * Requires CALENDAR_MANAGE (same gate as accept/decline).
 * Rate-limited: 10 calls / 15 min / IP.
 *
 * Body: { "action": "summarize" | "reply_draft" }
 * Response: { ok: true, result: string, used_fallback: boolean, action: string }
 *
 * Never stores AI output. Never forwards anamnesis, health profile, or diagnoses.
 * Safe fallback returned on OpenAI error — appointment workflow unaffected.
 */
router.post(
  "/appointments/:appointmentId/assist",
  bookingAssistLimiter,
  async (req, res) => {
    try {
      const userId = uid(req);
      const practiceId = pid(req);

      if (!userId || !practiceId) {
        return res.status(400).json({ ok: false, error: "missing_required_params" });
      }

      const access = await getPracticeAccess(userId, practiceId);
      if (!access || !canManageCalendar(access.role)) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }

      const { action } = req.body || {};

      const result = await runAppointmentAssistant({
        appointmentId: req.params.appointmentId,
        practiceId,
        actorUserId: userId,
        actorRole: access.role,
        action,
      });

      return res.json({
        ok: true,
        result: result.result,
        used_fallback: result.used_fallback,
        action: result.action,
      });
    } catch (e) {
      const m = mapError(e);
      return res.status(m.status).json({ ok: false, error: m.error });
    }
  },
);

export default router;
