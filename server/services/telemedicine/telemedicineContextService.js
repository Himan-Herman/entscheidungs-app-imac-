/**
 * Video consultations inside ONE care relationship (Phase 2G.2).
 *
 * SCOPE — and why it is not simply "every session of this patient"
 * ----------------------------------------------------------------
 * `TelemedicineSession.practicePatientLinkId` is NULLABLE, and that is
 * deliberate, not a defect. Both creation paths can legitimately produce a
 * session without one:
 *
 *   ensureTelemedicineForAppointment copies the appointment's link, which is
 *     itself nullable,
 *   createPracticeSession leaves it null when the practice creates a session
 *     that is not tied to a connected patient.
 *
 * Such a session belongs to a practice but to no determinable relationship. It
 * is NOT shown here: a consultation attributed to the wrong relationship is
 * worse than one the patient reaches through the cross-practice page.
 *
 * So the scope is the link and the patient, both load-bearing:
 *
 *     practicePatientLinkId = link.id  AND  patientUserId = link.patientUserId
 *
 * AUTHORIZATION IS NOT LISTING
 * ----------------------------
 * Being able to see a session in a list is not permission to join it. Every
 * action re-derives its own authorization at the moment it happens, and the
 * existing patient-side service functions are called through rather than
 * reimplemented — they carry the consent gate, the revocation check and the
 * audit trail that joining a consultation requires.
 */
import { prisma } from "../../lib/prisma.js";
import {
  grantPatientConsent,
  patientJoinWaitingRoom,
  patientLeaveSession,
} from "./telemedicineService.js";

/**
 * The link, only if it belongs to the session patient.
 *
 * A missing link and someone else's link both raise `link_not_found`.
 */
async function assertPatientOwnsLink(linkId, patientUserId) {
  const lid = String(linkId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!lid || !uid) throw new Error("validation_required");

  const link = await prisma.practicePatientLink.findFirst({
    where: { id: lid, patientUserId: uid },
    select: { id: true, patientUserId: true, practiceProfileId: true, status: true },
  });
  if (!link) throw new Error("link_not_found");
  return link;
}

/** The one scope clause. */
function contextWhere(link) {
  return { practicePatientLinkId: link.id, patientUserId: link.patientUserId };
}

/**
 * What the context page needs.
 *
 * `providerRoomId` is deliberately absent. For the sandbox provider the meeting
 * URL is `https://meet.jit.si/MedScoutX-<providerRoomId>` — the room id IS the
 * only thing protecting the room. Handing it out in a list would let anyone
 * holding the response reconstruct the meeting URL and bypass the join
 * endpoint, which is where the consent and revocation checks live. The client
 * never used the field; the join URL is issued by the join call and nowhere
 * else.
 *
 * Also omitted: `practiceProfileId` and `practicePatientLinkId` (the URL and
 * the context bar already say which relationship this is).
 */
function contextSessionJson(row) {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
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
    hasJoinLink: Boolean(row.joinUrlHash && !row.linkRevokedAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Consultations of ONE care relationship.
 *
 * Two queries whatever the number of sessions: the link lookup and one
 * findMany. The existing ordering and cap are kept.
 */
export async function listPatientLinkSessions(linkId, patientUserId) {
  const link = await assertPatientOwnsLink(linkId, patientUserId);

  const rows = await prisma.telemedicineSession.findMany({
    where: contextWhere(link),
    orderBy: [{ scheduledStartAt: "asc" }, { id: "asc" }],
    take: 50,
  });
  return rows.map(contextSessionJson);
}

/**
 * One session, but only if it lives in THIS context.
 *
 * The scope is part of the query rather than a comparison on a row already
 * fetched by id.
 */
async function loadInContext(linkId, sessionId, patientUserId) {
  const link = await assertPatientOwnsLink(linkId, patientUserId);
  const id = String(sessionId || "").trim();
  if (!id) throw new Error("validation_required");

  const row = await prisma.telemedicineSession.findFirst({
    where: { id, ...contextWhere(link) },
  });
  if (!row) throw new Error("session_not_found");
  return { link, row };
}

export async function getPatientLinkSession(linkId, sessionId, patientUserId) {
  const { row } = await loadInContext(linkId, sessionId, patientUserId);
  const participants = await prisma.telemedicineParticipant.findMany({
    where: { sessionId: row.id },
    // Roles and states only — never the participants' identities.
    select: { id: true, role: true, status: true, joinedAt: true, leftAt: true },
  });
  return { ...contextSessionJson(row), participants };
}

/**
 * Joining, re-authorized at the moment it happens.
 *
 * The context check comes first, then the existing patient-side join runs its
 * own checks again: consent, revocation, and the session still belonging to
 * this patient. A stale list on the client can therefore not turn into a join.
 */
export async function joinPatientLinkSession(linkId, sessionId, patientUserId, ctx = {}) {
  await loadInContext(linkId, sessionId, patientUserId);
  return patientJoinWaitingRoom(patientUserId, sessionId, ctx.body || {}, ctx);
}

export async function leavePatientLinkSession(linkId, sessionId, patientUserId, ctx = {}) {
  await loadInContext(linkId, sessionId, patientUserId);
  return patientLeaveSession(patientUserId, sessionId, ctx);
}

export async function grantPatientLinkConsent(linkId, sessionId, patientUserId, ctx = {}) {
  await loadInContext(linkId, sessionId, patientUserId);
  return grantPatientConsent(patientUserId, sessionId, ctx);
}
