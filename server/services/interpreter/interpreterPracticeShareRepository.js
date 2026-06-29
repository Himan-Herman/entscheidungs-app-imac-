/**
 * Persistence for practice interpreter session links — Prisma only.
 */

import { prisma } from "../../lib/prisma.js";


/**
 * @param {import('@prisma/client').PracticeInterpreterSessionLink} row
 */
export function sessionLinkToListDto(row) {
  return {
    id: row.id,
    clientSessionId: row.clientSessionId,
    consentStatus: row.consentStatus,
    consentGrantedAt: row.consentGrantedAt?.toISOString() ?? undefined,
    consentRevokedAt: row.consentRevokedAt?.toISOString() ?? undefined,
    hasPayload: Boolean(row.payload),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    patientLanguage: row.payload?.patientLanguage ?? undefined,
    doctorLanguage: row.payload?.doctorLanguage ?? undefined,
    sessionStatus: row.payload?.sessionStatus ?? undefined,
    turnCount: row.payload?.turnCount ?? undefined,
  };
}

/**
 * @param {string} practiceProfileId
 * @param {{ consentStatus?: string; limit?: number }} [opts]
 */
export async function listSessionLinksForPractice(practiceProfileId, opts = {}) {
  const where = {
    practiceProfileId,
    ...(opts.consentStatus
      ? { consentStatus: opts.consentStatus }
      : { consentStatus: "granted" }),
  };
  return prisma.practiceInterpreterSessionLink.findMany({
    where,
    orderBy: { consentGrantedAt: "desc" },
    take: opts.limit ?? 100,
    include: { payload: true },
  });
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function findSessionLinkForPractice(linkId, practiceProfileId) {
  return prisma.practiceInterpreterSessionLink.findFirst({
    where: { id: linkId, practiceProfileId },
    include: { payload: true, practiceProfile: { select: { practiceName: true } } },
  });
}

/**
 * @param {string} linkId
 * @param {string} patientUserId
 */
export async function findSessionLinkForPatient(linkId, patientUserId) {
  return prisma.practiceInterpreterSessionLink.findFirst({
    where: { id: linkId, patientUserId },
    include: { payload: true, practiceProfile: { select: { practiceName: true, displayNameForPatients: true } } },
  });
}

/**
 * @param {string} practiceProfileId
 * @param {string} patientUserId
 * @param {string} clientSessionId
 */
export async function findSessionLinkByClientSession(
  practiceProfileId,
  patientUserId,
  clientSessionId,
) {
  return prisma.practiceInterpreterSessionLink.findUnique({
    where: {
      practiceProfileId_patientUserId_clientSessionId: {
        practiceProfileId,
        patientUserId,
        clientSessionId,
      },
    },
    include: { payload: true },
  });
}

/**
 * @param {object} data
 */
export async function createSessionLinkRow(data) {
  return prisma.practiceInterpreterSessionLink.create({ data });
}

/**
 * @param {string} id
 * @param {object} data
 */
export async function updateSessionLinkRow(id, data) {
  return prisma.practiceInterpreterSessionLink.update({
    where: { id },
    data,
  });
}

/**
 * @param {string} linkId
 * @param {object} data
 */
export async function upsertSharePayload(linkId, data) {
  return prisma.practiceInterpreterSharePayload.upsert({
    where: { linkId },
    create: { linkId, ...data },
    update: data,
  });
}

/**
 * @param {string} linkId
 */
export async function deleteSharePayload(linkId) {
  return prisma.practiceInterpreterSharePayload.deleteMany({
    where: { linkId },
  });
}

/**
 * @param {string} patientUserId
 */
/**
 * @param {string} practiceProfileId
 */
export async function isActivePracticeProfile(practiceProfileId) {
  const row = await prisma.practiceProfile.findUnique({
    where: { id: practiceProfileId },
    select: { isActive: true },
  });
  return row?.isActive === true;
}

export async function listSessionLinksForPatient(patientUserId) {
  return prisma.practiceInterpreterSessionLink.findMany({
    where: { patientUserId },
    orderBy: { updatedAt: "desc" },
    include: {
      practiceProfile: {
        select: { practiceName: true, displayNameForPatients: true },
      },
    },
  });
}
