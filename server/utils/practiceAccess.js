import { PrismaClient } from "@prisma/client";
import { hasPracticePermission } from "./practicePermissions.js";

const prisma = new PrismaClient();

export {
  canAccessPracticeDataApi,
  canManageIntegrations,
  canManageTeam,
  canReadPracticePatientLinks,
  canViewIntegrationSettings,
  canWritePracticePatientLinks,
  hasPracticePermission,
  PERMISSIONS,
} from "./practicePermissions.js";

export {
  canPracticeArchive,
  canPracticeSoftDelete,
  canPracticeRestoreFromArchive,
} from "./lifecycleAccess.js";

/**
 * @param {string} userId
 * @param {string} practiceId
 * @returns {Promise<{ practice: import('@prisma/client').PracticeProfile, role: string, membershipId: string | null } | null>}
 */
export async function getPracticeAccess(userId, practiceId) {
  if (!userId || !practiceId) return null;
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
  });
  if (!practice) return null;
  if (practice.userId === userId) {
    return { practice, role: "owner", membershipId: null };
  }
  const member = await prisma.practiceMember.findUnique({
    where: {
      practiceProfileId_userId: { practiceProfileId: practiceId, userId },
    },
  });
  if (!member || member.status !== "active") return null;
  return {
    practice,
    role: member.role,
    membershipId: member.id,
  };
}

/**
 * @param {string} role
 * @param {string} permission
 */
export function requirePermission(role, permission) {
  if (!hasPracticePermission(role, permission)) {
    const err = new Error("forbidden");
    throw err;
  }
}
