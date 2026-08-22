import { prisma } from "../../lib/prisma.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import {
  canManageTelemedicine,
  canReadTelemedicine,
} from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";
import { isTelemedicineUiEnabled } from "../../config/featureFlags.js";
import { getVideoAdapter } from "./videoProviderAdapter.js";
import { notifyTelemedicineEvent } from "./telemedicineNotify.js";


const SESSION_STATUSES = new Set([
  "planned",
  "waiting",
  "active",
  "completed",
  "cancelled",
  "failed",
]);

async function getPracticeVideoSettings(practiceId) {
  return prisma.practiceTelemedicineSettings.upsert({
    where: { practiceProfileId: practiceId },
    create: { practiceProfileId: practiceId },
    update: {},
  });
}

function sessionToJson(row, { includeParticipants = false } = {}) {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
    practiceProfileId: row.practiceProfileId,
    practicePatientLinkId: row.practicePatientLinkId,
    // Global patientUserId withheld from API responses; notifications consume
    // the Prisma row directly, so nothing depends on it being serialized.
    providerType: row.providerType,
    status: row.status,
    title: row.title,
    scheduledStartAt: row.scheduledStartAt,
    scheduledEndAt: row.scheduledEndAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    linkRevoked: Boolean(row.linkRevokedAt),
    consentGranted: Boolean(row.consentAcceptedAt),
    consentVersion: row.consentVersion,
    // `providerRoomId` is NOT serialized. For the sandbox provider the meeting
    // URL is https://meet.jit.si/MedScoutX-<providerRoomId>, so the room id is
    // the only thing protecting the room — a bearer secret in everything but
    // name. Returning it in a list or a detail response let anyone holding that
    // response reconstruct the URL and enter without passing the join endpoint,
    // where consent, revocation and ownership are checked.
    //
    // Nothing reads it on the client. The meeting URL reaches a patient through
    // patientJoinWaitingRoom() and a practice through startPracticeSession(),
    // both of which read the Prisma row directly rather than this payload.
    hasJoinLink: Boolean(row.joinUrlHash && !row.linkRevokedAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    participants: includeParticipants
      ? (row.participants || []).map((p) => ({
          id: p.id,
          role: p.role,
          status: p.status,
          userId: p.userId,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
        }))
      : undefined,
  };
}

async function hasActiveConsent(sessionId, patientUserId) {
  const c = await prisma.telemedicineConsent.findFirst({
    where: { sessionId, patientUserId, status: "granted" },
    orderBy: { grantedAt: "desc" },
  });
  return Boolean(c);
}

/**
 * Create telemedicine session for video appointment.
 * @param {import('@prisma/client').PracticeAppointment} appointment
 * @param {string} actorUserId
 */
export async function ensureTelemedicineForAppointment(appointment, actorUserId, ctx = {}) {
  if (!isTelemedicineUiEnabled()) return null;
  if (appointment.locationType !== "video") return null;

  const existing = await prisma.telemedicineSession.findUnique({
    where: { appointmentId: appointment.id },
  });
  if (existing) return sessionToJson(existing);

  const settings = await getPracticeVideoSettings(appointment.practiceProfileId);
  const providerType = settings.externalLinkMode ? "external_link" : settings.providerType || "sandbox";
  const adapter = getVideoAdapter(providerType);
  const room = await adapter.createRoom({ externalUrl: appointment.locationText });

  if (!room.ok) return null;

  const session = await prisma.telemedicineSession.create({
    data: {
      appointmentId: appointment.id,
      practiceProfileId: appointment.practiceProfileId,
      practicePatientLinkId: appointment.practicePatientLinkId,
      patientUserId: appointment.patientUserId,
      providerType,
      status: "planned",
      title: appointment.title,
      scheduledStartAt: appointment.startAt,
      scheduledEndAt: appointment.endAt,
      joinUrlHash: room.joinUrlHash,
      hostUrlHash: room.hostUrlHash,
      providerRoomId: room.providerRoomId,
      consentVersion: settings.consentVersion,
      createdByUserId: actorUserId,
    },
  });

  if (appointment.patientUserId) {
    await prisma.telemedicineParticipant.create({
      data: {
        sessionId: session.id,
        userId: appointment.patientUserId,
        role: "patient",
        status: "invited",
      },
    });
  }

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: "system",
    action: "telemedicine_session_created",
    practiceProfileId: appointment.practiceProfileId,
    metadata: { sessionId: session.id, appointmentId: appointment.id },
  });

  await notifyTelemedicineEvent(session, "created");
  await notifyTelemedicineEvent(session, "link");

  return sessionToJson(session);
}

export async function listPracticeSessions(actorUserId, practiceId, query = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadTelemedicine(access.role)) throw new Error("forbidden");

  const where = { practiceProfileId: practiceId };
  if (query.status) where.status = String(query.status);

  const rows = await prisma.telemedicineSession.findMany({
    where,
    include: { participants: true },
    orderBy: { scheduledStartAt: "asc" },
    take: 100,
  });
  return rows.map((r) => sessionToJson(r, { includeParticipants: true }));
}

export async function createPracticeSession(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageTelemedicine(access.role)) throw new Error("forbidden");

  // The patient is derived from the link, never taken from the request body.
  // Trusting body.patientUserId allowed a practice to bind a session (and the
  // inbox notification it triggers) to an arbitrary account. The link is also
  // re-checked against this practice, so a foreign link cannot be attached.
  let practicePatientLinkId = null;
  let patientUserId = null;
  if (body.practicePatientLinkId) {
    const link = await prisma.practicePatientLink.findFirst({
      where: {
        id: String(body.practicePatientLinkId),
        practiceProfileId: practiceId,
      },
      select: { id: true, patientUserId: true },
    });
    if (!link) throw new Error("link_not_found");
    practicePatientLinkId = link.id;
    patientUserId = link.patientUserId;
  }

  const settings = await getPracticeVideoSettings(practiceId);
  const providerType = String(body.providerType || settings.providerType || "sandbox");
  const adapter = getVideoAdapter(providerType);
  const room = await adapter.createRoom({ externalUrl: body.externalUrl });
  if (!room.ok) throw new Error(room.error || "room_create_failed");

  const session = await prisma.telemedicineSession.create({
    data: {
      practiceProfileId: practiceId,
      practicePatientLinkId,
      patientUserId,
      appointmentId: body.appointmentId || null,
      providerType,
      status: "planned",
      title: body.title ? String(body.title).slice(0, 200) : null,
      scheduledStartAt: body.scheduledStartAt ? new Date(body.scheduledStartAt) : null,
      scheduledEndAt: body.scheduledEndAt ? new Date(body.scheduledEndAt) : null,
      joinUrlHash: room.joinUrlHash,
      hostUrlHash: room.hostUrlHash,
      providerRoomId: room.providerRoomId,
      consentVersion: settings.consentVersion,
      createdByUserId: actorUserId,
    },
    include: { participants: true },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "telemedicine_session_created",
    practiceProfileId: practiceId,
    metadata: { sessionId: session.id },
  });

  await notifyTelemedicineEvent(session, "created");
  return sessionToJson(session, { includeParticipants: true });
}

export async function getPracticeSession(actorUserId, practiceId, sessionId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canReadTelemedicine(access.role)) throw new Error("forbidden");

  const row = await prisma.telemedicineSession.findFirst({
    where: { id: sessionId, practiceProfileId: practiceId },
    include: { participants: true },
  });
  if (!row) throw new Error("session_not_found");
  return sessionToJson(row, { includeParticipants: true });
}

export async function startPracticeSession(actorUserId, practiceId, sessionId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageTelemedicine(access.role)) throw new Error("forbidden");

  const row = await prisma.telemedicineSession.update({
    where: { id: sessionId, practiceProfileId: practiceId },
    data: { status: "active", startedAt: new Date() },
    include: { participants: true },
  });

  const existingPractice = await prisma.telemedicineParticipant.findFirst({
    where: { sessionId, userId: actorUserId, role: "practice" },
  });
  if (existingPractice) {
    await prisma.telemedicineParticipant.update({
      where: { id: existingPractice.id },
      data: { status: "joined", joinedAt: new Date() },
    });
  } else {
    await prisma.telemedicineParticipant.create({
      data: {
        sessionId,
        userId: actorUserId,
        role: "practice",
        status: "joined",
        joinedAt: new Date(),
      },
    });
  }

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "telemedicine_session_started",
    practiceProfileId: practiceId,
    metadata: { sessionId },
  });

  const hostUrl = getVideoAdapter(row.providerType).getHostUrl(
    { providerRoomId: row.providerRoomId },
    null,
  );

  return { session: sessionToJson(row, { includeParticipants: true }), hostUrl };
}

export async function completePracticeSession(actorUserId, practiceId, sessionId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageTelemedicine(access.role)) throw new Error("forbidden");

  const row = await prisma.telemedicineSession.update({
    where: { id: sessionId, practiceProfileId: practiceId },
    data: { status: "completed", endedAt: new Date() },
    include: { participants: true },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "telemedicine_session_completed",
    practiceProfileId: practiceId,
    metadata: { sessionId },
  });

  await notifyTelemedicineEvent(row, "completed");
  return sessionToJson(row, { includeParticipants: true });
}

export async function cancelPracticeSession(actorUserId, practiceId, sessionId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageTelemedicine(access.role)) throw new Error("forbidden");

  const row = await prisma.telemedicineSession.update({
    where: { id: sessionId, practiceProfileId: practiceId },
    data: { status: "cancelled", endedAt: new Date() },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "telemedicine_session_cancelled",
    practiceProfileId: practiceId,
    metadata: { sessionId },
  });

  await notifyTelemedicineEvent(row, "cancelled");
  return sessionToJson(row);
}

export async function revokeSessionLink(actorUserId, practiceId, sessionId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageTelemedicine(access.role)) throw new Error("forbidden");

  const row = await prisma.telemedicineSession.update({
    where: { id: sessionId, practiceProfileId: practiceId },
    data: { linkRevokedAt: new Date() },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "telemedicine_link_revoked",
    practiceProfileId: practiceId,
    metadata: { sessionId },
  });

  return sessionToJson(row);
}

// ——— Patient ———

export async function listPatientSessions(patientUserId) {
  const rows = await prisma.telemedicineSession.findMany({
    where: { patientUserId },
    orderBy: { scheduledStartAt: "asc" },
    take: 50,
  });
  return rows.map((r) => sessionToJson(r));
}

export async function getPatientSession(patientUserId, sessionId) {
  const row = await prisma.telemedicineSession.findFirst({
    where: { id: sessionId, patientUserId },
    include: { participants: true },
  });
  if (!row) throw new Error("session_not_found");
  return sessionToJson(row, { includeParticipants: true });
}

export async function grantPatientConsent(patientUserId, sessionId, ctx = {}) {
  const row = await prisma.telemedicineSession.findFirst({
    where: { id: sessionId, patientUserId },
  });
  if (!row) throw new Error("session_not_found");
  if (row.linkRevokedAt) throw new Error("link_revoked");

  const version = row.consentVersion || "1";
  await prisma.telemedicineConsent.create({
    data: {
      sessionId,
      patientUserId,
      consentVersion: version,
      status: "granted",
      grantedAt: new Date(),
    },
  });

  const updated = await prisma.telemedicineSession.update({
    where: { id: sessionId },
    data: { consentAcceptedAt: new Date(), consentVersion: version },
  });

  writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "telemedicine_consent_granted",
    practiceProfileId: row.practiceProfileId,
    metadata: { sessionId, consentVersion: version },
  });

  await notifyTelemedicineEvent(updated, "consent");
  return sessionToJson(updated);
}

export async function patientJoinWaitingRoom(patientUserId, sessionId, body, ctx = {}) {
  const row = await prisma.telemedicineSession.findFirst({
    where: { id: sessionId, patientUserId },
  });
  if (!row) throw new Error("session_not_found");
  if (row.linkRevokedAt) throw new Error("link_revoked");
  if (!row.consentAcceptedAt && !(await hasActiveConsent(sessionId, patientUserId))) {
    throw new Error("consent_required");
  }

  const existingPatient = await prisma.telemedicineParticipant.findFirst({
    where: { sessionId, userId: patientUserId, role: "patient" },
  });
  if (existingPatient) {
    await prisma.telemedicineParticipant.update({
      where: { id: existingPatient.id },
      data: { status: "waiting", leftAt: null },
    });
  } else {
    await prisma.telemedicineParticipant.create({
      data: {
        sessionId,
        userId: patientUserId,
        role: "patient",
        status: "waiting",
      },
    });
  }

  const updated = await prisma.telemedicineSession.update({
    where: { id: sessionId },
    data: { status: row.status === "planned" ? "waiting" : row.status },
  });

  writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "telemedicine_patient_waiting",
    practiceProfileId: row.practiceProfileId,
    metadata: { sessionId },
  });

  await notifyTelemedicineEvent(updated, "waiting");

  const joinUrl = getVideoAdapter(row.providerType).getJoinUrl(
    { providerRoomId: row.providerRoomId },
    null,
  );

  writeAuditLog({
    req: ctx.req,
    userId: patientUserId,
    actorRole: "patient",
    action: "telemedicine_link_opened",
    practiceProfileId: row.practiceProfileId,
    metadata: { sessionId, opened: true },
  });

  return { session: sessionToJson(updated), joinUrl };
}

export async function patientLeaveSession(patientUserId, sessionId, ctx = {}) {
  const row = await prisma.telemedicineSession.findFirst({
    where: { id: sessionId, patientUserId },
  });
  if (!row) throw new Error("session_not_found");

  await prisma.telemedicineParticipant.updateMany({
    where: { sessionId, userId: patientUserId },
    data: { status: "left", leftAt: new Date() },
  });

  return sessionToJson(row);
}

export async function getProviderStatus(sessionId, actorUserId, isPractice) {
  const row = await prisma.telemedicineSession.findUnique({ where: { id: sessionId } });
  if (!row) throw new Error("session_not_found");
  if (!isPractice && row.patientUserId !== actorUserId) throw new Error("forbidden");

  const adapter = getVideoAdapter(row.providerType);
  return adapter.checkStatus({ providerRoomId: row.providerRoomId });
}
