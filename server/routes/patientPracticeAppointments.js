/**
 * Patient appointments INSIDE one care relationship —
 * /api/patient/practice/:linkId/appointments
 *
 * The link-scoped counterpart of /api/patient/appointments. Both address the
 * same domain service; only the scope differs, so there is no second
 * appointment implementation to keep in step.
 *
 * AUTHORIZATION
 * -------------
 * Scope is the session user plus the linkId in the path. No practiceId, no
 * patientId and no appointmentId is ever trusted on its own: every handler
 * resolves session patient -> owned link -> appointment on that link, in the
 * database query itself.
 *
 * RIGHTS ARE UNCHANGED
 * --------------------
 * Exactly the operations the cross-practice page already offered — read,
 * confirm, cancel a request. This migration narrows the scope; it grants
 * nothing new.
 */

import express from "express";
import { requirePracticeCalendarFeature } from "../middleware/requirePracticeCalendar.js";
import {
  cancelPatientLinkAppointmentRequest,
  confirmPatientLinkAppointment,
  getPatientLinkAppointment,
  listPatientLinkAppointments,
} from "../services/calendar/appointmentService.js";

const router = express.Router({ mergeParams: true });

router.use(requirePracticeCalendarFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required") return { status: 400, error: msg };
  // A foreign link and a missing appointment are both "not found", so neither
  // can be used to probe what exists.
  if (msg === "link_not_found" || msg === "appointment_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "invalid_status_transition" || msg === "appointment_cancelled") {
    return { status: 409, error: msg };
  }
  if (msg === "forbidden") return { status: 403, error: msg };
  return { status: 500, error: "request_failed" };
}

/** GET / — appointments of this care relationship */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const appointments = await listPatientLinkAppointments(userId, req.params.linkId);
    return res.json({ ok: true, appointments });
  } catch (err) {
    console.error("[patient/practice/appointments/list]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** GET /:appointmentId */
router.get("/:appointmentId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const appointment = await getPatientLinkAppointment(
      userId,
      req.params.linkId,
      req.params.appointmentId,
    );
    return res.json({ ok: true, appointment });
  } catch (err) {
    console.error("[patient/practice/appointments/get]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** PATCH /:appointmentId/confirm */
router.patch("/:appointmentId/confirm", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const appointment = await confirmPatientLinkAppointment(
      userId,
      req.params.linkId,
      req.params.appointmentId,
      { req },
    );
    return res.json({ ok: true, appointment });
  } catch (err) {
    console.error("[patient/practice/appointments/confirm]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** PATCH /:appointmentId/cancel-request */
router.patch("/:appointmentId/cancel-request", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const appointment = await cancelPatientLinkAppointmentRequest(
      userId,
      req.params.linkId,
      req.params.appointmentId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, appointment });
  } catch (err) {
    console.error("[patient/practice/appointments/cancel]", err?.message ?? err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
