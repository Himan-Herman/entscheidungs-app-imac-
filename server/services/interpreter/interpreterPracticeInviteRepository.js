/**
 * Persistence for interpreter practice invites — Prisma only.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * @param {import('@prisma/client').PracticeInterpreterInvite} row
 */
export function inviteToListDto(row) {
  const now = Date.now();
  const expired =
    row.status === "active" &&
    row.expiresAt &&
    new Date(row.expiresAt).getTime() <= now;
  const effectiveStatus = expired ? "expired" : row.status;
  return {
    id: row.id,
    displayName: row.displayName ?? undefined,
    inviteType: row.inviteType,
    status: effectiveStatus,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? undefined,
    maxUses: row.maxUses ?? undefined,
    usageCount: row.usageCount,
    tokenPrefix: row.tokenPrefix ?? undefined,
    metadataVersion: row.metadataVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * @param {string} practiceProfileId
 */
export async function countActiveInvites(practiceProfileId) {
  const now = new Date();
  return prisma.practiceInterpreterInvite.count({
    where: {
      practiceProfileId,
      status: "active",
      expiresAt: { gt: now },
    },
  });
}

/**
 * @param {string} practiceProfileId
 */
export async function listInvitesByPractice(practiceProfileId) {
  return prisma.practiceInterpreterInvite.findMany({
    where: { practiceProfileId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * @param {string} tokenHash
 */
export async function findInviteByTokenHash(tokenHash) {
  return prisma.practiceInterpreterInvite.findUnique({
    where: { tokenHash },
    include: {
      practiceProfile: {
        select: {
          id: true,
          practiceName: true,
          displayNameForPatients: true,
          isActive: true,
        },
      },
    },
  });
}

/**
 * @param {string} id
 * @param {string} practiceProfileId
 */
export async function findInviteByIdForPractice(id, practiceProfileId) {
  return prisma.practiceInterpreterInvite.findFirst({
    where: { id, practiceProfileId },
  });
}

/**
 * @param {object} data
 */
export async function createInviteRow(data) {
  return prisma.practiceInterpreterInvite.create({ data });
}

/**
 * @param {string} id
 * @param {object} data
 */
export async function updateInviteRow(id, data) {
  return prisma.practiceInterpreterInvite.update({
    where: { id },
    data,
  });
}

/**
 * @param {string} inviteId
 * @param {string | null} ipHash
 */
export async function recordInviteUsage(inviteId, ipHash) {
  return prisma.$transaction(async (tx) => {
    await tx.practiceInterpreterInviteUsage.create({
      data: {
        inviteId,
        ipHash: ipHash || null,
      },
    });
    return tx.practiceInterpreterInvite.update({
      where: { id: inviteId },
      data: { usageCount: { increment: 1 } },
    });
  });
}
