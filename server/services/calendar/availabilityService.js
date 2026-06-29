import { prisma } from "../../lib/prisma.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import {
  canManageCalendarSettings,
  canReadCalendar,
} from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";


function availabilityToJson(row) {
  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    appointmentTypeId: row.appointmentTypeId,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    timezone: row.timezone,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAvailability(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadCalendar(access.role)) throw new Error("forbidden");
  const rows = await prisma.practiceAvailability.findMany({
    where: { practiceProfileId: practiceId },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
  return rows.map(availabilityToJson);
}

export async function createAvailability(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendarSettings(access.role)) throw new Error("forbidden");
  const weekday = Number(body.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("invalid_weekday");
  const startTime = String(body.startTime || "").slice(0, 8);
  const endTime = String(body.endTime || "").slice(0, 8);
  if (!startTime || !endTime) throw new Error("time_required");
  const row = await prisma.practiceAvailability.create({
    data: {
      practiceProfileId: practiceId,
      appointmentTypeId: body.appointmentTypeId
        ? String(body.appointmentTypeId).trim()
        : null,
      weekday,
      startTime,
      endTime,
      timezone: String(body.timezone || "Europe/Berlin").slice(0, 64),
      active: body.active !== false,
    },
  });
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "availability_created",
    practiceProfileId: practiceId,
    metadata: { availabilityId: row.id, weekday },
  }).catch(() => {});
  return availabilityToJson(row);
}

export async function patchAvailability(actorUserId, practiceId, availabilityId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendarSettings(access.role)) throw new Error("forbidden");
  const existing = await prisma.practiceAvailability.findFirst({
    where: { id: availabilityId, practiceProfileId: practiceId },
  });
  if (!existing) throw new Error("availability_not_found");
  const data = {};
  if (body.weekday !== undefined) {
    const weekday = Number(body.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("invalid_weekday");
    data.weekday = weekday;
  }
  if (body.startTime !== undefined) data.startTime = String(body.startTime).slice(0, 8);
  if (body.endTime !== undefined) data.endTime = String(body.endTime).slice(0, 8);
  if (body.timezone !== undefined) data.timezone = String(body.timezone).slice(0, 64);
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.appointmentTypeId !== undefined) {
    data.appointmentTypeId = body.appointmentTypeId
      ? String(body.appointmentTypeId).trim()
      : null;
  }
  const row = await prisma.practiceAvailability.update({
    where: { id: availabilityId },
    data,
  });
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "availability_updated",
    practiceProfileId: practiceId,
    metadata: { availabilityId },
  }).catch(() => {});
  return availabilityToJson(row);
}

export async function deleteAvailability(actorUserId, practiceId, availabilityId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendarSettings(access.role)) throw new Error("forbidden");
  const result = await prisma.practiceAvailability.deleteMany({
    where: { id: availabilityId, practiceProfileId: practiceId },
  });
  if (!result.count) throw new Error("availability_not_found");
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "availability_deleted",
    practiceProfileId: practiceId,
    metadata: { availabilityId },
  }).catch(() => {});
  return { ok: true };
}
