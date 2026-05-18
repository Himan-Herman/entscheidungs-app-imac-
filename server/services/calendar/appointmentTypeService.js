import { PrismaClient } from "@prisma/client";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import {
  canManageCalendarSettings,
  canReadCalendar,
} from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";
import {
  DEFAULT_APPOINTMENT_TYPES,
  defaultTypeDisplayName,
} from "./calendarConstants.js";

const prisma = new PrismaClient();

export async function ensureDefaultAppointmentTypes(practiceId, locale = "de") {
  const count = await prisma.appointmentType.count({ where: { practiceProfileId: practiceId } });
  if (count > 0) return;
  await prisma.appointmentType.createMany({
    data: DEFAULT_APPOINTMENT_TYPES.map((t) => ({
      practiceProfileId: practiceId,
      name: defaultTypeDisplayName(t.nameKey, locale),
      durationMinutes: t.durationMinutes,
      color: t.color,
      active: true,
    })),
  });
}

function typeToJson(row) {
  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    name: row.name,
    durationMinutes: row.durationMinutes,
    color: row.color,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAppointmentTypes(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadCalendar(access.role)) throw new Error("forbidden");
  await ensureDefaultAppointmentTypes(practiceId);
  const rows = await prisma.appointmentType.findMany({
    where: { practiceProfileId: practiceId, active: true },
    orderBy: { name: "asc" },
  });
  return rows.map(typeToJson);
}

export async function createAppointmentType(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendarSettings(access.role)) throw new Error("forbidden");
  const name = String(body.name || "").trim().slice(0, 120);
  if (!name) throw new Error("name_required");
  const row = await prisma.appointmentType.create({
    data: {
      practiceProfileId: practiceId,
      name,
      durationMinutes: Math.min(240, Math.max(5, Number(body.durationMinutes) || 30)),
      color: body.color ? String(body.color).slice(0, 32) : null,
      active: true,
    },
  });
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "appointment_type_created",
    practiceProfileId: practiceId,
    metadata: { appointmentTypeId: row.id },
  }).catch(() => {});
  return typeToJson(row);
}

export async function patchAppointmentType(actorUserId, practiceId, typeId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendarSettings(access.role)) throw new Error("forbidden");
  const existing = await prisma.appointmentType.findFirst({
    where: { id: typeId, practiceProfileId: practiceId },
  });
  if (!existing) throw new Error("type_not_found");
  const data = {};
  if (body.name !== undefined) {
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) throw new Error("name_required");
    data.name = name;
  }
  if (body.durationMinutes !== undefined) {
    data.durationMinutes = Math.min(240, Math.max(5, Number(body.durationMinutes) || 30));
  }
  if (body.color !== undefined) data.color = body.color ? String(body.color).slice(0, 32) : null;
  const row = await prisma.appointmentType.update({ where: { id: typeId }, data });
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "appointment_type_updated",
    practiceProfileId: practiceId,
    metadata: { appointmentTypeId: typeId },
  }).catch(() => {});
  return typeToJson(row);
}

export async function archiveAppointmentType(actorUserId, practiceId, typeId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageCalendarSettings(access.role)) throw new Error("forbidden");
  const row = await prisma.appointmentType.updateMany({
    where: { id: typeId, practiceProfileId: practiceId },
    data: { active: false },
  });
  if (!row.count) throw new Error("type_not_found");
  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "appointment_type_archived",
    practiceProfileId: practiceId,
    metadata: { appointmentTypeId: typeId },
  }).catch(() => {});
  return { ok: true };
}
