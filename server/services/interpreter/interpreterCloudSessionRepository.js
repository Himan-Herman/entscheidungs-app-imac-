/**
 * Persistence layer for interpreter cloud sessions — Prisma only.
 * No business rules, audit, or encryption here.
 */

import { prisma } from "../../lib/prisma.js";
import {
  INTERPRETER_CLOUD_CONSENT_VERSION,
  INTERPRETER_CLOUD_SCHEMA_VERSION,
} from "../../config/interpreterCloudEnv.js";


export { prisma as interpreterCloudPrisma };

/**
 * @param {string} userId
 */
export async function findCloudPreference(userId) {
  return prisma.interpreterCloudPreference.findUnique({ where: { userId } });
}

/**
 * @param {string} userId
 */
export async function upsertCloudPreferenceGranted(userId) {
  const now = new Date();
  return prisma.interpreterCloudPreference.upsert({
    where: { userId },
    create: {
      userId,
      cloudEnabled: true,
      consentVersion: INTERPRETER_CLOUD_CONSENT_VERSION,
      consentGrantedAt: now,
      consentRevokedAt: null,
    },
    update: {
      cloudEnabled: true,
      consentVersion: INTERPRETER_CLOUD_CONSENT_VERSION,
      consentGrantedAt: now,
      consentRevokedAt: null,
    },
  });
}

/**
 * @param {string} userId
 */
export async function upsertCloudPreferenceRevoked(userId) {
  const now = new Date();
  return prisma.interpreterCloudPreference.upsert({
    where: { userId },
    create: {
      userId,
      cloudEnabled: false,
      consentRevokedAt: now,
    },
    update: {
      cloudEnabled: false,
      consentRevokedAt: now,
    },
  });
}

/**
 * @param {string} userId
 */
export async function countActiveCloudSessions(userId) {
  return prisma.interpreterCloudSession.count({
    where: { userId, deletedAt: null },
  });
}

/**
 * @param {string} userId
 */
export async function countAllCloudSessions(userId) {
  return prisma.interpreterCloudSession.count({ where: { userId } });
}

/**
 * @param {string} userId
 */
export async function listCloudSessionRows(userId) {
  return prisma.interpreterCloudSession.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * @param {string} userId
 */
export async function listCloudSessionRowsWithPayload(userId) {
  return prisma.interpreterCloudSession.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { payload: true },
  });
}

/**
 * @param {string} userId
 * @param {string} clientSessionId
 */
export async function findCloudSessionByClientId(userId, clientSessionId) {
  return prisma.interpreterCloudSession.findFirst({
    where: { userId, clientSessionId, deletedAt: null },
  });
}

/**
 * @param {string} userId
 * @param {string} clientSessionId
 */
export async function findCloudSessionWithPayload(userId, clientSessionId) {
  return prisma.interpreterCloudSession.findFirst({
    where: { userId, clientSessionId, deletedAt: null },
    include: { payload: true },
  });
}

/**
 * @param {string} userId
 * @param {string} clientSessionId
 */
export async function findCloudSessionUnique(userId, clientSessionId) {
  return prisma.interpreterCloudSession.findUnique({
    where: {
      userId_clientSessionId: { userId, clientSessionId },
    },
    include: { payload: true },
  });
}

/**
 * @param {object} data
 */
export async function createCloudSessionRow(data) {
  return prisma.interpreterCloudSession.create({ data });
}

/**
 * @param {string} sessionRowId
 */
export async function deleteCloudSessionRowById(sessionRowId) {
  return prisma.interpreterCloudSession.delete({ where: { id: sessionRowId } });
}

/**
 * @param {string} userId
 */
export async function deleteAllCloudSessionRows(userId) {
  return prisma.interpreterCloudSession.deleteMany({ where: { userId } });
}

/**
 * @param {string} existingRowId
 * @param {string} userId
 * @param {object} sessionFields
 * @param {{ payloadEnc: string; checksumSha256: string | null }} enc
 */
export async function updateCloudSessionWithPayload(
  existingRowId,
  userId,
  sessionFields,
  enc,
) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const row = await tx.interpreterCloudSession.update({
      where: { id: existingRowId },
      data: {
        ...sessionFields,
        deletedAt: null,
        updatedAt: now,
      },
    });
    await tx.interpreterCloudSessionPayload.upsert({
      where: { sessionId: existingRowId },
      create: {
        sessionId: existingRowId,
        userId,
        payloadEnc: enc.payloadEnc,
        payloadVersion: 1,
        checksumSha256: enc.checksumSha256,
      },
      update: {
        payloadEnc: enc.payloadEnc,
        checksumSha256: enc.checksumSha256,
        updatedAt: now,
      },
    });
    return row;
  });
}

/**
 * @param {string} sessionRowId
 * @param {string} userId
 * @param {{ payloadEnc: string; checksumSha256: string | null }} enc
 */
export async function createCloudSessionPayload(
  sessionRowId,
  userId,
  enc,
) {
  return prisma.interpreterCloudSessionPayload.create({
    data: {
      sessionId: sessionRowId,
      userId,
      payloadEnc: enc.payloadEnc,
      payloadVersion: 1,
      checksumSha256: enc.checksumSha256,
    },
  });
}

export { INTERPRETER_CLOUD_SCHEMA_VERSION };
