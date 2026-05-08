import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getPracticeAccess(userId, practiceId) {
  if (!userId || !practiceId) return null;
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
  });
  if (!practice) return null;
  if (practice.userId === userId) return { practice, role: "owner" };
  const member = await prisma.practiceMember.findUnique({
    where: {
      practiceProfileId_userId: { practiceProfileId: practiceId, userId },
    },
  });
  if (!member) return null;
  return { practice, role: member.role };
}

export function canManageIntegrations(role) {
  return role === "owner" || role === "admin";
}

export function canViewIntegrationSettings(role) {
  return ["owner", "admin", "doctor", "assistant", "viewer"].includes(role);
}

export function canAccessPracticeDataApi(role) {
  return ["owner", "admin", "doctor", "assistant"].includes(role);
}
