import { PrismaClient } from "@prisma/client";
import { isPatientInboxEnabled } from "../../config/featureFlags.js";
import { createInboxItem } from "../patientInbox/patientInboxService.js";

const prisma = new PrismaClient();

export const INBOX_MEDICATION_TITLE_DE =
  "Neue Medikationsinformation von Ihrer Praxis";
export const INBOX_MEDICATION_TITLE_EN =
  "New medication information from your practice";

export function inboxMedicationTitleForLanguage(lang) {
  return String(lang || "").toLowerCase().startsWith("en")
    ? INBOX_MEDICATION_TITLE_EN
    : INBOX_MEDICATION_TITLE_DE;
}

/**
 * @param {{ id: string, patientUserId: string, practiceProfileId: string, practicePatientLinkId: string }} plan
 */
export async function notifyPatientInboxOfMedicationPlan(plan) {
  if (!isPatientInboxEnabled()) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: plan.patientUserId },
      include: { profile: true },
    });
    const practice = await prisma.practiceProfile.findUnique({
      where: { id: plan.practiceProfileId },
      select: { practiceName: true },
    });

    const title = inboxMedicationTitleForLanguage(
      user?.profile?.preferredPatientLanguage,
    );

    return await createInboxItem({
      patientUserId: plan.patientUserId,
      practiceProfileId: plan.practiceProfileId,
      practicePatientLinkId: plan.practicePatientLinkId,
      type: "medication",
      title,
      sourceLabel: practice?.practiceName ?? null,
      targetUrl: `/patient/medication-plans/${plan.id}`,
    });
  } catch (err) {
    console.error("[medication-plan/inbox-notify]", err?.message ?? err);
    return null;
  }
}
