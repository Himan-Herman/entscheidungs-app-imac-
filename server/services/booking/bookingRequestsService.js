import { PrismaClient } from "@prisma/client";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import {
  canReadBooking,
  canManageCalendar,
} from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";
import { notifyAppointmentEvent } from "../calendar/appointmentNotify.js";
import {
  scheduleAppointmentReminders,
  cancelAppointmentReminders,
} from "../reminders/appointmentReminderSchedule.js";
import { APPOINTMENT_STATUSES, LOCATION_TYPES } from "../calendar/calendarConstants.js";

const prisma = new PrismaClient();

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Serialises a PracticeAppointment for booking-request API responses.
 * Sensitive free-text fields are omitted when includeNotes=false (viewer role).
 */
function requestToJson(row, { includeNotes = true } = {}) {
  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    practicePatientLinkId: row.practicePatientLinkId,
    patientUserId: row.patientUserId,
    appointmentTypeId: row.appointmentTypeId,
    title: row.title,
    status: row.status,
    startAt: row.startAt,
    endAt: row.endAt,
    timezone: row.timezone,
    locationType: row.locationType,
    locationText: row.locationText,
    requestedStartAt: row.requestedStartAt,
    requestedEndAt: row.requestedEndAt,
    // viewer-filtered fields
    patientNote: includeNotes ? row.patientNote : undefined,
    practiceNote: includeNotes ? row.practiceNote : undefined,
    cancellationReason: includeNotes ? row.cancellationReason : undefined,
    requestConsentScope: includeNotes ? row.requestConsentScope : undefined,
    // consent metadata visible to all managers (non-sensitive)
    requestConsentGrantedAt: row.requestConsentGrantedAt,
    requestConsentVersion: row.requestConsentVersion,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    appointmentType: row.appointmentType
      ? {
          id: row.appointmentType.id,
          name: row.appointmentType.name,
          color: row.appointmentType.color,
          durationMinutes: row.appointmentType.durationMinutes,
        }
      : null,
  };
}

/**
 * Lists appointment requests for a practice.
 *
 * Default filter: status=requested.
 * Optional query params: status, from (ISO), to (ISO), appointmentTypeId.
 *
 * Viewer-safe: patientNote, practiceNote, cancellationReason, requestConsentScope
 * are omitted for roles without CALENDAR_MANAGE.
 */
export async function listBookingRequests(actorUserId, practiceId, query = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadBooking(access.role)) throw new Error("forbidden");

  const status =
    typeof query.status === "string" && query.status.trim()
      ? query.status.trim()
      : "requested";

  if (!APPOINTMENT_STATUSES.has(status)) throw new Error("invalid_status");

  const where = { practiceProfileId: practiceId, status };

  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from || to) {
    where.startAt = {};
    if (from) where.startAt.gte = from;
    if (to) where.startAt.lte = to;
  }

  if (query.appointmentTypeId) {
    where.appointmentTypeId = String(query.appointmentTypeId);
  }

  const rows = await prisma.practiceAppointment.findMany({
    where,
    include: { appointmentType: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const includeNotes = canManageCalendar(access.role);
  return {
    requests: rows.map((r) => requestToJson(r, { includeNotes })),
    canManage: canManageCalendar(access.role),
  };
}

/**
 * Accepts a booking request: status → confirmed with a confirmed time slot.
 *
 * Required body: startAt (ISO), endAt (ISO).
 * Optional body: practiceNote, locationType, locationText.
 *
 * Requires CALENDAR_MANAGE. Appointment must currently be status=requested.
 */
export async function acceptBookingRequest(
  actorUserId,
  practiceId,
  appointmentId,
  body,
  ctx = {},
) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendar(access.role)) throw new Error("forbidden");

  const existing = await prisma.practiceAppointment.findFirst({
    where: { id: appointmentId, practiceProfileId: practiceId },
  });
  if (!existing) throw new Error("appointment_not_found");
  if (existing.status !== "requested") throw new Error("not_a_request");

  const startAt = parseDate(body.startAt);
  const endAt = parseDate(body.endAt);
  if (!startAt || !endAt || endAt <= startAt) throw new Error("invalid_time_range");

  const conflict = await prisma.practiceAppointment.findFirst({
    where: {
      practiceProfileId: practiceId,
      id: { not: appointmentId },
      status: { notIn: ["cancelled", "no_show"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (conflict) throw new Error("time_slot_conflict");

  const data = { status: "confirmed", startAt, endAt };

  if (body.practiceNote !== undefined) {
    data.practiceNote = body.practiceNote
      ? String(body.practiceNote).slice(0, 2000)
      : null;
  }
  if (body.locationType !== undefined) {
    const lt = String(body.locationType);
    if (!LOCATION_TYPES.has(lt)) throw new Error("invalid_location_type");
    data.locationType = lt;
  }
  if (body.locationText !== undefined) {
    data.locationText = body.locationText
      ? String(body.locationText).slice(0, 300)
      : null;
  }

  const row = await prisma.practiceAppointment.update({
    where: { id: appointmentId },
    data,
    include: { appointmentType: true },
  });

  await scheduleAppointmentReminders(row.id, row.startAt);
  await notifyAppointmentEvent(row, "confirmed");

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "booking_request_accepted",
    practiceProfileId: practiceId,
    metadata: { appointmentId, startAt: row.startAt },
  }).catch(() => {});

  return requestToJson(row, { includeNotes: true });
}

/**
 * Declines a booking request: status → cancelled.
 *
 * Optional body: reason (string, max 500 chars).
 *
 * Requires CALENDAR_MANAGE. Appointment must currently be status=requested.
 */
export async function declineBookingRequest(
  actorUserId,
  practiceId,
  appointmentId,
  body,
  ctx = {},
) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendar(access.role)) throw new Error("forbidden");

  const existing = await prisma.practiceAppointment.findFirst({
    where: { id: appointmentId, practiceProfileId: practiceId },
  });
  if (!existing) throw new Error("appointment_not_found");
  if (existing.status !== "requested") throw new Error("not_a_request");

  const row = await prisma.practiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: actorUserId,
      cancellationReason: body.reason
        ? String(body.reason).slice(0, 500)
        : null,
    },
    include: { appointmentType: true },
  });

  await cancelAppointmentReminders(appointmentId);
  await notifyAppointmentEvent(row, "declined");

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "booking_request_declined",
    practiceProfileId: practiceId,
    metadata: { appointmentId },
  }).catch(() => {});

  return requestToJson(row, { includeNotes: true });
}
