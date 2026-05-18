import { notifyPatientInbox } from "../patientInbox/patientInboxNotify.js";

/**
 * @param {{ id: string, patientUserId: string, practiceProfileId: string, practicePatientLinkId: string }} plan
 */
export async function notifyPatientInboxOfMedicationPlan(plan) {
  return notifyPatientInbox({
    patientUserId: plan.patientUserId,
    practiceProfileId: plan.practiceProfileId,
    practicePatientLinkId: plan.practicePatientLinkId,
    type: "medication",
    titleKey: "medication",
    targetUrl: `/patient/medication-plans/${plan.id}`,
  });
}
