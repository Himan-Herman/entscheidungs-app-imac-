import { PrismaClient } from "@prisma/client";
import { notifyPracticeInboxOfMedicationQuestion } from "../practiceInbox/practiceInboxNotify.js";
import { getMedicationPlanForPatient } from "./medicationPlanService.js";

const prisma = new PrismaClient();

/**
 * Patient asks a question about a published plan — practice inbox only (neutral titles).
 * Question text is not stored in inbox title/summary or audit metadata.
 * @param {string} planId
 * @param {string} patientUserId
 */
export async function submitPatientMedicationPlanQuestion(planId, patientUserId) {
  const plan = await getMedicationPlanForPatient(planId, patientUserId);

  const link = await prisma.practicePatientLink.findFirst({
    where: {
      id: plan.practicePatientLinkId,
      patientUserId,
      practiceProfileId: plan.practiceProfileId,
    },
    select: { id: true, status: true },
  });
  if (!link || !["active", "invited"].includes(link.status)) {
    throw new Error("link_not_active");
  }

  await notifyPracticeInboxOfMedicationQuestion({
    id: plan.id,
    practiceProfileId: plan.practiceProfileId,
    practicePatientLinkId: plan.practicePatientLinkId,
    patientUserId: plan.patientUserId,
  });

  return { ok: true, planId: plan.id };
}
