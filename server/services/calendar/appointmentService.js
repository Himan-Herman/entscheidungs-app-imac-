import { prisma } from "../../lib/prisma.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageCalendar, canReadCalendar } from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";
import { APPOINTMENT_STATUSES, LOCATION_TYPES } from "./calendarConstants.js";
import { notifyAppointmentEvent } from "./appointmentNotify.js";
import { ensureTelemedicineForAppointment } from "../telemedicine/telemedicineService.js";
import {
  cancelAppointmentReminders,
  rescheduleAppointmentReminders,
  scheduleAppointmentReminders,
} from "../reminders/appointmentReminderSchedule.js";


function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Locales for which organisational email templates exist. */
const EMAIL_LOCALES = new Set(["de", "en", "fr", "it", "es"]);

/**
 * Normalise a raw locale string to a supported email locale.
 * Falls back to "de" for any unrecognised or empty value.
 */
export function resolveEmailLocale(raw) {
  if (!raw) return "de";
  const code = String(raw).toLowerCase().split(/[-_]/)[0];
  return EMAIL_LOCALES.has(code) ? code : "de";
}

/**
 * @param {object} row
 * @param {{ includeNotes?: boolean, includePracticeNote?: boolean }} opts
 *   includeNotes      — controls patientNote (default true)
 *   includePracticeNote — controls practiceNote; defaults to includeNotes when not set.
 *                         Set to false for all patient-facing endpoints.
 */
function appointmentToJson(row, { includeNotes = true, includePracticeNote } = {}) {
  const showPracticeNote = includePracticeNote !== undefined ? includePracticeNote : includeNotes;
  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    practicePatientLinkId: row.practicePatientLinkId,
    patientUserId: row.patientUserId,
    appointmentTypeId: row.appointmentTypeId,
    preVisitSessionId: row.preVisitSessionId,
    title: row.title,
    status: row.status,
    startAt: row.startAt,
    endAt: row.endAt,
    timezone: row.timezone,
    locationType: row.locationType,
    locationText: row.locationText,
    communicationLocale: row.communicationLocale || null,
    patientNote: includeNotes ? row.patientNote : undefined,
    practiceNote: showPracticeNote ? row.practiceNote : undefined,
    requestedStartAt: row.requestedStartAt,
    requestedEndAt: row.requestedEndAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason || null,
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
    preVisitUrl: row.preVisitSessionId
      ? `/practice/preparations/${row.preVisitSessionId}?practiceId=${row.practiceProfileId}`
      : null,
    telemedicineSessionId: row.telemedicineSession?.id || row.telemedicineSessionId || null,
  };
}

async function resolveLink(practiceId, linkId) {
  if (!linkId) return null;
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId: practiceId, status: "active" },
    select: { id: true, patientUserId: true },
  });
  if (!link) throw new Error("link_not_found");
  return link;
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {{ from?: string, to?: string, status?: string, appointmentTypeId?: string }} query
 */
export async function listPracticeAppointments(actorUserId, practiceId, query = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadCalendar(access.role)) throw new Error("forbidden");

  const where = { practiceProfileId: practiceId };
  if (query.status) where.status = String(query.status);
  if (query.appointmentTypeId) where.appointmentTypeId = String(query.appointmentTypeId);
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from || to) {
    where.startAt = {};
    if (from) where.startAt.gte = from;
    if (to) where.startAt.lte = to;
  }

  const rows = await prisma.practiceAppointment.findMany({
    where,
    include: { appointmentType: true },
    orderBy: { startAt: "asc" },
    take: 500,
  });
  return rows.map((r) => appointmentToJson(r, { includeNotes: canManageCalendar(access.role) }));
}

export async function getPracticeAppointment(actorUserId, practiceId, appointmentId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadCalendar(access.role)) throw new Error("forbidden");
  const row = await prisma.practiceAppointment.findFirst({
    where: { id: appointmentId, practiceProfileId: practiceId },
    include: { appointmentType: true },
  });
  if (!row) throw new Error("appointment_not_found");
  return appointmentToJson(row);
}

export async function createPracticeAppointment(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendar(access.role)) throw new Error("forbidden");

  const startAt = parseDate(body.startAt);
  const endAt = parseDate(body.endAt);
  if (!startAt || !endAt || endAt <= startAt) throw new Error("invalid_time_range");

  const link = body.practicePatientLinkId
    ? await resolveLink(practiceId, String(body.practicePatientLinkId))
    : null;

  let status = String(body.status || "scheduled").trim();
  if (!APPOINTMENT_STATUSES.has(status)) status = "scheduled";

  const locationType = String(body.locationType || "practice");
  if (!LOCATION_TYPES.has(locationType)) throw new Error("invalid_location_type");

  const row = await prisma.practiceAppointment.create({
    data: {
      practiceProfileId: practiceId,
      practicePatientLinkId: link?.id,
      patientUserId: link?.patientUserId || body.patientUserId || null,
      appointmentTypeId: body.appointmentTypeId || null,
      preVisitSessionId: body.preVisitSessionId || null,
      title: String(body.title || "Termin").trim().slice(0, 200),
      status,
      startAt,
      endAt,
      timezone: String(body.timezone || "Europe/Berlin").slice(0, 64),
      locationType,
      locationText: body.locationText ? String(body.locationText).slice(0, 300) : null,
      practiceNote: body.practiceNote ? String(body.practiceNote).slice(0, 2000) : null,
      patientNote: body.patientNote ? String(body.patientNote).slice(0, 2000) : null,
      createdByUserId: actorUserId,
    },
    include: { appointmentType: true },
  });

  if (status === "confirmed" || status === "scheduled") {
    await scheduleReminders(row.id, startAt);
  }
  await notifyAppointmentEvent(row, status === "requested" ? "request" : "created");

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "appointment_created",
    practiceProfileId: practiceId,
    metadata: {
      appointmentId: row.id,
      status: row.status,
      practicePatientLinkId: row.practicePatientLinkId,
      patientUserId: row.patientUserId,
    },
  }).catch(() => {});

  if (locationType === "video") {
    await ensureTelemedicineForAppointment(row, actorUserId, ctx).catch(() => {});
  }

  const json = appointmentToJson(row);
  const tele = await prisma.telemedicineSession.findUnique({
    where: { appointmentId: row.id },
    select: { id: true },
  });
  if (tele) json.telemedicineSessionId = tele.id;

  import("../practiceDeveloper/emitDeveloperEvents.js")
    .then((m) => m.emitAppointmentCreated(row))
    .catch(() => {});

  return json;
}

export async function patchPracticeAppointment(
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
  if (existing.status === "cancelled") throw new Error("appointment_cancelled");

  const data = {};
  if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 200);
  if (body.startAt !== undefined) {
    const startAt = parseDate(body.startAt);
    if (!startAt) throw new Error("invalid_time_range");
    data.startAt = startAt;
  }
  if (body.endAt !== undefined) {
    const endAt = parseDate(body.endAt);
    if (!endAt) throw new Error("invalid_time_range");
    data.endAt = endAt;
  }
  if (body.locationType !== undefined) {
    const lt = String(body.locationType);
    if (!LOCATION_TYPES.has(lt)) throw new Error("invalid_location_type");
    data.locationType = lt;
  }
  if (body.locationText !== undefined) {
    data.locationText = body.locationText ? String(body.locationText).slice(0, 300) : null;
  }
  if (body.practiceNote !== undefined) {
    data.practiceNote = body.practiceNote ? String(body.practiceNote).slice(0, 2000) : null;
  }
  if (body.appointmentTypeId !== undefined) data.appointmentTypeId = body.appointmentTypeId || null;
  if (body.practicePatientLinkId !== undefined) {
    const link = body.practicePatientLinkId
      ? await resolveLink(practiceId, String(body.practicePatientLinkId))
      : null;
    data.practicePatientLinkId = link?.id ?? null;
    data.patientUserId = link?.patientUserId ?? null;
  }

  const row = await prisma.practiceAppointment.update({
    where: { id: appointmentId },
    data,
    include: { appointmentType: true },
  });

  await notifyAppointmentEvent(row, "updated");
  if (data.startAt) {
    await rescheduleAppointmentReminders(row.id, row.startAt);
  }
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "appointment_updated",
    practiceProfileId: practiceId,
    metadata: { appointmentId, fields: Object.keys(data) },
  }).catch(() => {});

  return appointmentToJson(row);
}

export async function patchAppointmentStatus(
  actorUserId,
  practiceId,
  appointmentId,
  body,
  ctx = {},
) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendar(access.role)) throw new Error("forbidden");

  const status = String(body.status || "").trim();
  if (!APPOINTMENT_STATUSES.has(status)) throw new Error("invalid_status");

  const row = await prisma.practiceAppointment.update({
    where: { id: appointmentId, practiceProfileId: practiceId },
    data: { status },
    include: { appointmentType: true },
  });

  if (status === "confirmed") await scheduleReminders(row.id, row.startAt);
  await notifyAppointmentEvent(row, status === "confirmed" ? "confirmed" : "updated");

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: status === "confirmed" ? "appointment_confirmed" : "appointment_updated",
    practiceProfileId: practiceId,
    metadata: { appointmentId, status },
  }).catch(() => {});

  return appointmentToJson(row);
}

export async function cancelPracticeAppointment(
  actorUserId,
  practiceId,
  appointmentId,
  body,
  ctx = {},
) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendar(access.role)) throw new Error("forbidden");

  const row = await prisma.practiceAppointment.update({
    where: { id: appointmentId, practiceProfileId: practiceId },
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

  await notifyAppointmentEvent(row, "cancelledByPractice");
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "appointment_cancelled",
    practiceProfileId: practiceId,
    metadata: { appointmentId },
  }).catch(() => {});

  return appointmentToJson(row);
}

export async function reschedulePracticeAppointment(
  actorUserId,
  practiceId,
  appointmentId,
  body,
  ctx = {},
) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendar(access.role)) throw new Error("forbidden");

  const startAt = parseDate(body.startAt);
  const endAt = parseDate(body.endAt);
  if (!startAt || !endAt || endAt <= startAt) throw new Error("invalid_time_range");

  const row = await prisma.practiceAppointment.update({
    where: { id: appointmentId, practiceProfileId: practiceId },
    data: { startAt, endAt, status: "rescheduled" },
    include: { appointmentType: true },
  });

  await notifyAppointmentEvent(row, "rescheduled");
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "appointment_rescheduled",
    practiceProfileId: practiceId,
    metadata: { appointmentId },
  }).catch(() => {});

  return appointmentToJson(row);
}

// ——— Patient APIs ———

export async function listPatientAppointments(patientUserId) {
  const rows = await prisma.practiceAppointment.findMany({
    where: { patientUserId },
    include: {
      appointmentType: true,
      practiceProfile: {
        select: {
          practiceName: true,
          phone: true,
          email: true,
          address: true,
          street: true,
          city: true,
          postalCode: true,
          specialty: true,
        },
      },
    },
    orderBy: { startAt: "asc" },
    take: 200,
  });
  return rows.map((r) => {
    const p = r.practiceProfile;
    const addressParts = [p?.street, p?.city, p?.postalCode].filter(Boolean);
    return {
      ...appointmentToJson(r, { includeNotes: true, includePracticeNote: false }),
      practiceName: p?.practiceName || null,
      practicePhone: p?.phone || null,
      practiceEmail: p?.email || null,
      practiceAddress: p?.address || (addressParts.length ? addressParts.join(", ") : null),
      practiceSpecialty: p?.specialty || null,
    };
  });
}

export async function getPatientAppointment(patientUserId, appointmentId) {
  const row = await prisma.practiceAppointment.findFirst({
    where: { id: appointmentId, patientUserId },
    include: {
      appointmentType: true,
      practiceProfile: {
        select: {
          practiceName: true,
          phone: true,
          email: true,
          address: true,
          street: true,
          city: true,
          postalCode: true,
          specialty: true,
        },
      },
    },
  });
  if (!row) throw new Error("appointment_not_found");
  const p = row.practiceProfile;
  const addressParts = [p?.street, p?.city, p?.postalCode].filter(Boolean);
  return {
    ...appointmentToJson(row, { includeNotes: true, includePracticeNote: false }),
    practiceName: p?.practiceName || null,
    practicePhone: p?.phone || null,
    practiceEmail: p?.email || null,
    practiceAddress: p?.address || (addressParts.length ? addressParts.join(", ") : null),
    practiceSpecialty: p?.specialty || null,
  };
}

export async function requestPatientAppointment(patientUserId, body, ctx = {}) {
  const practiceId = String(body.practiceProfileId || "").trim();
  if (!practiceId) throw new Error("practiceId_required");

  const bookingSettings = await prisma.practiceBookingSettings.findUnique({
    where: { practiceProfileId: practiceId },
    select: { bookingEnabled: true, bookingMode: true },
  });
  if (!bookingSettings?.bookingEnabled || bookingSettings.bookingMode !== "medscoutx_request") {
    throw new Error("practice_booking_disabled");
  }

  if (body.consentAccepted !== true) throw new Error("appointment_request_consent_required");

  const link = await prisma.practicePatientLink.findFirst({
    where: {
      practiceProfileId: practiceId,
      patientUserId,
      status: "active",
    },
  });
  if (!link) throw new Error("link_not_found");

  const requestedStartAt = parseDate(body.requestedStartAt || body.startAt);
  const requestedEndAt = parseDate(body.requestedEndAt || body.endAt);
  const consentGrantedAt = new Date();
  const communicationLocale = resolveEmailLocale(body.locale);

  const row = await prisma.practiceAppointment.create({
    data: {
      practiceProfileId: practiceId,
      practicePatientLinkId: link.id,
      patientUserId,
      appointmentTypeId: body.appointmentTypeId || null,
      title: String(body.title || "Terminanfrage").trim().slice(0, 200),
      status: "requested",
      startAt: requestedStartAt || new Date(),
      endAt: requestedEndAt || new Date(Date.now() + 30 * 60000),
      requestedStartAt,
      requestedEndAt,
      timezone: String(body.timezone || "Europe/Berlin").slice(0, 64),
      locationType: String(body.locationType || "practice"),
      patientNote: body.patientNote ? String(body.patientNote).slice(0, 2000) : null,
      communicationLocale,
      requestConsentGrantedAt: consentGrantedAt,
      requestConsentVersion: "1.0",
      requestConsentScope: "appointment_request_v1",
      createdByUserId: patientUserId,
    },
    include: { appointmentType: true },
  });

  await notifyAppointmentEvent(row, "request");
  writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "appointment_request_created",
    practiceProfileId: practiceId,
    metadata: {
      appointmentId: row.id,
      practicePatientLinkId: link.id,
    },
  }).catch(() => {});

  return appointmentToJson(row);
}

export async function confirmPatientAppointment(patientUserId, appointmentId, ctx = {}) {
  const existing = await prisma.practiceAppointment.findFirst({
    where: { id: appointmentId, patientUserId },
  });
  if (!existing) throw new Error("appointment_not_found");
  if (!["scheduled", "requested", "rescheduled"].includes(existing.status)) {
    throw new Error("invalid_status_transition");
  }

  const row = await prisma.practiceAppointment.update({
    where: { id: appointmentId },
    data: { status: "confirmed" },
    include: { appointmentType: true },
  });

  await scheduleAppointmentReminders(row.id, row.startAt);
  await notifyAppointmentEvent(row, "confirmed");
  writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "appointment_confirmed",
    practiceProfileId: row.practiceProfileId,
    metadata: { appointmentId },
  }).catch(() => {});

  return appointmentToJson(row);
}

export async function getPatientPracticeBookingStatus(patientUserId, practiceId) {
  const link = await prisma.practicePatientLink.findFirst({
    where: { practiceProfileId: practiceId, patientUserId, status: "active" },
    select: { id: true },
  });
  if (!link) throw new Error("link_not_found");

  const settings = await prisma.practiceBookingSettings.findUnique({
    where: { practiceProfileId: practiceId },
    select: { bookingEnabled: true, bookingMode: true },
  });

  return {
    bookingEnabled: settings?.bookingEnabled ?? false,
    bookingMode: settings?.bookingMode ?? "disabled",
  };
}

export async function patientCancelRequest(patientUserId, appointmentId, body, ctx = {}) {
  const existing = await prisma.practiceAppointment.findFirst({
    where: { id: appointmentId, patientUserId },
  });
  if (!existing) throw new Error("appointment_not_found");
  if (["cancelled", "completed", "no_show"].includes(existing.status)) {
    throw new Error("appointment_cancelled");
  }

  const reason = body.reason ? String(body.reason).slice(0, 500) : null;
  const row = await prisma.practiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: patientUserId,
      cancellationReason: reason,
    },
    include: { appointmentType: true },
  });

  await notifyAppointmentEvent(row, "cancelledByPatient");
  writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "appointment_cancelled_by_patient",
    practiceProfileId: row.practiceProfileId,
    metadata: { appointmentId },
  }).catch(() => {});

  return appointmentToJson(row);
}
