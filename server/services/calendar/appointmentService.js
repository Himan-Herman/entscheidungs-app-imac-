import { PrismaClient } from "@prisma/client";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageCalendar, canReadCalendar } from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";
import { APPOINTMENT_STATUSES, LOCATION_TYPES } from "./calendarConstants.js";
import { notifyAppointmentEvent } from "./appointmentNotify.js";
import { ensureTelemedicineForAppointment } from "../telemedicine/telemedicineService.js";

const prisma = new PrismaClient();

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function appointmentToJson(row, { includeNotes = true } = {}) {
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
    patientNote: includeNotes ? row.patientNote : undefined,
    practiceNote: includeNotes ? row.practiceNote : undefined,
    requestedStartAt: row.requestedStartAt,
    requestedEndAt: row.requestedEndAt,
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

async function scheduleReminders(appointmentId, startAt) {
  const sendAt = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
  if (sendAt <= new Date()) return;
  await prisma.appointmentReminder.createMany({
    data: [
      { appointmentId, type: "inbox", sendAt, status: "pending" },
      { appointmentId, type: "system", sendAt, status: "pending" },
    ],
  });
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

  await prisma.appointmentReminder.updateMany({
    where: { appointmentId, status: "pending" },
    data: { status: "cancelled" },
  });

  await notifyAppointmentEvent(row, "cancelled");
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
    include: { appointmentType: true, practiceProfile: { select: { practiceName: true } } },
    orderBy: { startAt: "asc" },
    take: 200,
  });
  return rows.map((r) => ({
    ...appointmentToJson(r, { includeNotes: true }),
    practiceName: r.practiceProfile?.practiceName,
  }));
}

export async function getPatientAppointment(patientUserId, appointmentId) {
  const row = await prisma.practiceAppointment.findFirst({
    where: { id: appointmentId, patientUserId },
    include: { appointmentType: true, practiceProfile: { select: { practiceName: true } } },
  });
  if (!row) throw new Error("appointment_not_found");
  return {
    ...appointmentToJson(row, { includeNotes: true }),
    practiceName: row.practiceProfile?.practiceName,
  };
}

export async function requestPatientAppointment(patientUserId, body, ctx = {}) {
  const practiceId = String(body.practiceProfileId || "").trim();
  if (!practiceId) throw new Error("practiceId_required");

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

  await scheduleReminders(row.id, row.startAt);
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

export async function patientCancelRequest(patientUserId, appointmentId, body, ctx = {}) {
  const existing = await prisma.practiceAppointment.findFirst({
    where: { id: appointmentId, patientUserId },
  });
  if (!existing) throw new Error("appointment_not_found");
  if (existing.status === "cancelled") throw new Error("appointment_cancelled");

  const cancelNote = body.reason
    ? String(body.reason).slice(0, 500)
    : "";
  const row = await prisma.practiceAppointment.update({
    where: { id: appointmentId },
    data: {
      patientNote: cancelNote
        ? `${existing.patientNote || ""}\n[Absage angefragt] ${cancelNote}`.trim().slice(0, 2000)
        : existing.patientNote,
    },
    include: { appointmentType: true },
  });

  await notifyAppointmentEvent(row, "cancelled");
  writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "appointment_cancel_requested",
    practiceProfileId: row.practiceProfileId,
    metadata: { appointmentId },
  }).catch(() => {});

  return appointmentToJson(row);
}
