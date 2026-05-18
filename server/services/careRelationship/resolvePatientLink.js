import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const linkIncludePractice = {
  practiceProfile: {
    select: {
      id: true,
      practiceName: true,
      publicSlug: true,
      specialty: true,
    },
  },
  patientProfile: {
    select: { id: true, displayName: true, relationLabel: true, userId: true },
  },
};

/**
 * Resolve a link for a practice-scoped request (RBAC checked separately).
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function resolvePatientLinkForPractice(linkId, practiceProfileId) {
  const id = String(linkId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  if (!id || !pid) throw new Error("validation_required");

  const row = await prisma.practicePatientLink.findFirst({
    where: { id, practiceProfileId: pid },
    include: linkIncludePractice,
  });
  if (!row) throw new Error("link_not_found");
  return row;
}

/**
 * Resolve a link owned by the authenticated patient account.
 * @param {string} linkId
 * @param {string} patientUserId
 */
export async function resolvePatientLinkForPatient(linkId, patientUserId) {
  const id = String(linkId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const row = await prisma.practicePatientLink.findFirst({
    where: { id, patientUserId: uid },
    include: linkIncludePractice,
  });
  if (!row) throw new Error("link_not_found");
  return row;
}
