import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import { linkHasConsentScope } from "../careRelationship/consentScopes.js";
import { updatePatientProfileAccess } from "../careRelationship/practicePatientProfileService.js";

const prisma = new PrismaClient();

export const REQUEST_TYPES = new Set(["deletion", "access_restriction", "export"]);
export const REQUEST_STATUSES = new Set([
  "submitted",
  "in_review",
  "completed",
  "rejected",
]);

const MAX_REASON_LEN = 1000;

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
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

  await writeAuditLog({
    userId: patientUserId,
    actorRole: "patient",
    action: "patient_data_request_submitted",
    entityType: "PatientDataRequest",
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
  const rows = await prisma.patientDataRequest.findMany({
    where: { patientUserId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(requestToJson);
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
  }));
}
