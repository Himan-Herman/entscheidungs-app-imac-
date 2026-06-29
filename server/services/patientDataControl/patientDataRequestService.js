import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";
import { linkHasConsentScope } from "../careRelationship/consentScopes.js";
import { updatePatientProfileAccess } from "../careRelationship/practicePatientProfileService.js";
import { notifyPracticeInboxOfDataRequest } from "../practiceInbox/practiceInboxNotify.js";
import { notifyPatientInboxOfDataRequestStatus } from "../patientInbox/patientInboxNotify.js";


export const REQUEST_TYPES = new Set(["deletion", "access_restriction", "export"]);
export const REQUEST_STATUSES = new Set([
  "submitted",
  "in_review",
  "completed",
  "rejected",
]);

const OPEN_STATUSES = ["submitted", "in_review"];
const MAX_REASON_LEN = 1000;
const MAX_RESPONSE_NOTE_LEN = 2000;

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

  await writeAuditLog({
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
    ...requestToJson(row),
    patient: row.patientUser
      ? {
          id: row.patientUser.id,
          firstName: row.patientUser.firstName,
          lastName: row.patientUser.lastName,
        }
      : null,
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

  await writeAuditLog({
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
 */
export async function listPatientDataRequests(patientUserId) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const rows = await prisma.patientDataRequest.findMany({
    where: { patientUserId: uid },
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
 */
export async function listPracticeDataRequests(practiceProfileId) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("validation_required");

  const rows = await prisma.patientDataRequest.findMany({
    where: { practiceProfileId: pid },
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
    ...requestToJson(row),
    patient: row.patientUser
      ? {
          id: row.patientUser.id,
          firstName: row.patientUser.firstName,
          lastName: row.patientUser.lastName,
        }
      : null,
    link: row.practicePatientLink
      ? { id: row.practicePatientLink.id, status: row.practicePatientLink.status }
      : null,
  }));
}

/**
 * @param {{ requestId: string, practiceProfileId: string, handlerUserId: string, status: string, responseNote?: string }} input
 */
export async function updatePracticeDataRequestStatus(input) {
  const id = String(input.requestId || "").trim();
  const pid = String(input.practiceProfileId || "").trim();
  const handlerId = String(input.handlerUserId || "").trim();
  const status = String(input.status || "").trim();

  if (!id || !pid || !handlerId) throw new Error("validation_required");
  if (!REQUEST_STATUSES.has(status)) throw new Error("validation_invalid_status");

  const row = await prisma.patientDataRequest.findFirst({
    where: { id, practiceProfileId: pid },
  });
  if (!row) throw new Error("request_not_found");

  // GDPR honesty guard (Art. 17): a "deletion" request must not be marked
  // "completed" unless a real erasure was actually executed. There is no automated
  // practice-scoped erasure yet, and K4's account-wide eraseUser is deliberately NOT
  // reused here — it would delete the patient's entire account and data at EVERY
  // practice, far beyond this single practice's request scope (and may conflict with
  // medical-record retention duties). Until a dedicated practice-scoped erasure
  // exists, a deletion request stays in manual review: the practice may set
  // "in_review" or "rejected" (with a reason), but cannot silently report "completed".
  if (row.type === "deletion" && status === "completed") {
    throw new Error("deletion_requires_manual_erasure");
  }

  const responseNote = input.responseNote
    ? String(input.responseNote).trim().slice(0, MAX_RESPONSE_NOTE_LEN) || null
    : null;

  const now = new Date();
  const data = {
    status,
    updatedAt: now,
    handledByUserId: handlerId,
    responseNote: responseNote ?? row.responseNote,
  };

  if (status === "completed" || status === "rejected") {
    data.completedAt = now;
  }

  const updated = await prisma.patientDataRequest.update({
    where: { id },
    data,
  });

  await writeAuditLog({
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
    },
  });

  if (status !== row.status) {
    await notifyPatientInboxOfDataRequestStatus(updated, row.status);
  }

  return requestToJson(updated);
}
