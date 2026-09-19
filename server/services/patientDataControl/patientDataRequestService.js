import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";
import { linkHasConsentScope } from "../careRelationship/consentScopes.js";
import { updatePatientProfileAccess } from "../careRelationship/practicePatientProfileService.js";
import { notifyPracticeInboxOfDataRequest } from "../practiceInbox/practiceInboxNotify.js";
import { notifyPatientInboxOfDataRequestStatus } from "../patientInbox/patientInboxNotify.js";


export const REQUEST_TYPES = new Set(["deletion", "access_restriction", "export"]);
/**
 * Every status a stored request can carry. "answered" is the one terminal
 * status written today; "completed" and "rejected" remain valid for rows
 * written before it and are read — and shown — as answered.
 */
export const REQUEST_STATUSES = new Set([
  "submitted",
  "in_review",
  "answered",
  "completed",
  "rejected",
]);

/**
 * What a practice may SET. Deliberately neutral:
 *   in_review — the practice is working on it (organisational, e.g. reception);
 *   answered  — the practice has sent its answer, nothing more. It does NOT
 *               mean data were deleted, an export was delivered or the
 *               request was granted; the answer text says what happened.
 */
export const PRACTICE_SETTABLE_STATUSES = new Set(["in_review", "answered"]);

/** Statuses after which a request is closed. */
export const TERMINAL_STATUSES = new Set(["answered", "completed", "rejected"]);

const OPEN_STATUSES = ["submitted", "in_review"];
const MAX_REASON_LEN = 1000;
const MAX_RESPONSE_NOTE_LEN = 2000;

/**
 * The PRACTICE's view of a request: everything but the patient's global account
 * id. A practice knows its patients by the relationship (practicePatientLinkId)
 * only — the same rule linkToJson follows for the link itself.
 *
 * @param {import("@prisma/client").PatientDataRequest} row
 */
function practiceRequestToJson(row) {
  const { patientUserId: _omit, ...rest } = requestToJson(row);
  return rest;
}

/** Name only — never the account id — for the practice-facing shapes. */
function practicePatientName(user) {
  return user ? { firstName: user.firstName, lastName: user.lastName } : null;
}

/**
 * @param {import("@prisma/client").PatientDataRequest} row
 */
function requestToJson(row) {
  return {
    id: row.id,
    patientUserId: row.patientUserId,
    practiceProfileId: row.practiceProfileId,
    practicePatientLinkId: row.practicePatientLinkId,
    type: row.type,
    status: row.status,
    reason: row.reason,
    responseNote: row.responseNote ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

/**
 * @param {string} requestId
 * @param {string} actorUserId
 * @param {"patient" | "practice"} actorKind
 */
export async function getPatientDataRequest(requestId, actorUserId, actorKind) {
  const id = String(requestId || "").trim();
  const uid = String(actorUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const row = await prisma.patientDataRequest.findUnique({
    where: { id },
    include: {
      patientUser: {
        select: { id: true, firstName: true, lastName: true },
      },
      practiceProfile: {
        select: { id: true, practiceName: true },
      },
    },
  });
  if (!row) throw new Error("request_not_found");

  if (actorKind === "patient") {
    if (row.patientUserId !== uid) throw new Error("forbidden");
  } else {
    throw new Error("validation_required");
  }

  return {
    ...requestToJson(row),
    practice: row.practiceProfile
      ? { id: row.practiceProfile.id, practiceName: row.practiceProfile.practiceName }
      : null,
  };
}

/**
 * @param {string} requestId
 * @param {string} practiceProfileId
 * @param {string} viewerUserId
 */
export async function getPracticeDataRequest(requestId, practiceProfileId, viewerUserId) {
  const id = String(requestId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  const uid = String(viewerUserId || "").trim();
  if (!id || !pid || !uid) throw new Error("validation_required");

  const row = await prisma.patientDataRequest.findFirst({
    where: { id, practiceProfileId: pid },
    include: {
      patientUser: {
        select: { id: true, firstName: true, lastName: true },
      },
      practicePatientLink: {
        select: { id: true, status: true, linkedAt: true },
      },
    },
  });
  if (!row) throw new Error("request_not_found");

  writeAuditLog({
    userId: uid,
    actorRole: "practice",
    action: "patient_data_request_viewed",
    entityType: "patient_data_request",
    entityId: row.id,
    metadata: {
      practiceProfileId: pid,
      patientUserId: row.patientUserId,
      practicePatientLinkId: row.practicePatientLinkId,
      requestType: row.type,
    },
  });

  return {
    ...practiceRequestToJson(row),
    patient: practicePatientName(row.patientUser),
    link: row.practicePatientLink
      ? {
          id: row.practicePatientLink.id,
          status: row.practicePatientLink.status,
          linkedAt: row.practicePatientLink.linkedAt,
        }
      : null,
  };
}

/**
 * @param {{ patientUserId: string, practicePatientLinkId?: string, practiceProfileId?: string, type: string, reason?: string }} input
 */
export async function createPatientDataRequest(input) {
  const patientUserId = String(input.patientUserId || "").trim();
  const linkId = String(input.practicePatientLinkId || "").trim();
  const type = String(input.type || "deletion").trim();

  if (!patientUserId) throw new Error("validation_required");
  if (!REQUEST_TYPES.has(type)) throw new Error("validation_invalid_type");

  let practiceProfileId = input.practiceProfileId
    ? String(input.practiceProfileId).trim()
    : null;

  let link = null;
  if (linkId) {
    link = await prisma.practicePatientLink.findFirst({
      where: { id: linkId, patientUserId },
    });
    if (!link) throw new Error("link_not_found");
    practiceProfileId = link.practiceProfileId;
  }

  const existing = await prisma.patientDataRequest.findFirst({
    where: {
      practicePatientLinkId: linkId || undefined,
      patientUserId,
      type,
      status: { in: OPEN_STATUSES },
    },
  });
  if (existing) throw new Error("request_already_open");

  const reason = input.reason
    ? String(input.reason).trim().slice(0, MAX_REASON_LEN) || null
    : null;

  const row = await prisma.patientDataRequest.create({
    data: {
      patientUserId,
      practiceProfileId,
      practicePatientLinkId: linkId || null,
      type,
      status: "submitted",
      reason,
    },
  });

  if (link && (type === "deletion" || type === "access_restriction")) {
    if (linkHasConsentScope(link, "profile")) {
      await updatePatientProfileAccess(linkId, patientUserId, false);
    }
  }

  await notifyPracticeInboxOfDataRequest(row);

  const action =
    type === "export"
      ? "patient_data_export_request_submitted"
      : "patient_data_request_submitted";

  writeAuditLog({
    userId: patientUserId,
    actorRole: "patient",
    action,
    entityType: "patient_data_request",
    entityId: row.id,
    metadata: {
      practiceProfileId,
      practicePatientLinkId: linkId || null,
      requestType: type,
    },
  });

  return requestToJson(row);
}

/**
 * @param {string} patientUserId
 * @param {{ linkId?: string|null }} [opts] only the requests to ONE practice
 *   relationship. Always additionally bound to the patient, so a foreign link id
 *   simply matches nothing.
 */
export async function listPatientDataRequests(patientUserId, opts = {}) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");
  const linkId = String(opts.linkId || "").trim();

  const rows = await prisma.patientDataRequest.findMany({
    where: { patientUserId: uid, ...(linkId ? { practicePatientLinkId: linkId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      practiceProfile: {
        select: { id: true, practiceName: true },
      },
    },
  });

  return rows.map((row) => ({
    ...requestToJson(row),
    practice: row.practiceProfile
      ? { id: row.practiceProfile.id, practiceName: row.practiceProfile.practiceName }
      : null,
  }));
}

/**
 * @param {string} practiceProfileId
 * @param {{ linkId?: string|null }} [opts] only ONE patient relationship of this
 *   practice (the per-patient record). Always additionally bound to the
 *   practice, so another practice's link id matches nothing.
 */
export async function listPracticeDataRequests(practiceProfileId, opts = {}) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("validation_required");
  const linkId = String(opts.linkId || "").trim();

  const rows = await prisma.patientDataRequest.findMany({
    where: { practiceProfileId: pid, ...(linkId ? { practicePatientLinkId: linkId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      patientUser: {
        select: { id: true, firstName: true, lastName: true },
      },
      practicePatientLink: {
        select: { id: true, status: true },
      },
    },
  });

  return rows.map((row) => ({
    ...practiceRequestToJson(row),
    patient: practicePatientName(row.patientUser),
    link: row.practicePatientLink
      ? { id: row.practicePatientLink.id, status: row.practicePatientLink.status }
      : null,
  }));
}

/**
 * Move a request forward — two steps, two levels of authority:
 *
 *   in_review  may be set by anyone who may triage (e.g. reception): it says
 *              "we are on it" and carries no content for the patient;
 *   answered   may be set only by a role that may manage data requests, and
 *              only together with a written answer: the answer IS the reply.
 *
 * Who may do what is decided by the caller from the practice's permission
 * model (`permissions.triage` / `permissions.answer`) and enforced here again,
 * so no route can grant more than the service allows.
 *
 * Closed requests stay closed: an answer is not silently rewritten later.
 *
 * @param {{ requestId: string, practiceProfileId: string, handlerUserId: string,
 *           handlerRole?: string|null, status: string, responseNote?: string,
 *           permissions: { triage: boolean, answer: boolean } }} input
 */
export async function updatePracticeDataRequestStatus(input) {
  const id = String(input.requestId || "").trim();
  const pid = String(input.practiceProfileId || "").trim();
  const handlerId = String(input.handlerUserId || "").trim();
  const status = String(input.status || "").trim();
  const canTriage = Boolean(input.permissions?.triage);
  const canAnswer = Boolean(input.permissions?.answer);

  if (!id || !pid || !handlerId) throw new Error("validation_required");
  if (!PRACTICE_SETTABLE_STATUSES.has(status)) throw new Error("validation_invalid_status");
  if (!canTriage && !canAnswer) throw new Error("forbidden");

  const responseNote = input.responseNote
    ? String(input.responseNote).trim().slice(0, MAX_RESPONSE_NOTE_LEN) || null
    : null;

  // The answer to the patient is content; only an answering role writes it.
  if (responseNote && !canAnswer) throw new Error("forbidden_answer");
  if (status === "answered") {
    if (!canAnswer) throw new Error("forbidden_answer");
    // "Beantwortet" must never be shown without an answer to read.
    if (!responseNote) throw new Error("validation_answer_required");
  }

  const row = await prisma.patientDataRequest.findFirst({
    where: { id, practiceProfileId: pid },
  });
  if (!row) throw new Error("request_not_found");
  if (!OPEN_STATUSES.includes(row.status)) throw new Error("request_already_answered");

  const now = new Date();
  const data = {
    status,
    updatedAt: now,
    handledByUserId: handlerId,
  };
  if (responseNote) data.responseNote = responseNote;
  if (status === "answered") data.completedAt = now;

  const updated = await prisma.patientDataRequest.update({
    where: { id },
    data,
  });

  // Who (user + practice role), when (the row's time) and which status — never
  // the answer text itself: it is already stored once, with the request.
  writeAuditLog({
    userId: handlerId,
    actorRole: "practice",
    action: "patient_data_request_status_changed",
    entityType: "patient_data_request",
    entityId: updated.id,
    metadata: {
      practiceProfileId: pid,
      patientUserId: updated.patientUserId,
      practicePatientLinkId: updated.practicePatientLinkId,
      requestType: updated.type,
      previousStatus: row.status,
      newStatus: status,
      practiceRole: input.handlerRole || null,
      answerSent: Boolean(responseNote),
    },
  });

  if (status !== row.status) {
    await notifyPatientInboxOfDataRequestStatus(updated, row.status);
  }

  return practiceRequestToJson(updated);
}
