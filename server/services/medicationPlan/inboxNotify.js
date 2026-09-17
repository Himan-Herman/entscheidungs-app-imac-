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
    // The canonical patient route. It used to be
    // `/patient/medication-plans/${plan.id}`, which matches NO route: the
    // patient-facing detail page has always lived under `/practice/:planId`.
    // Every notice written before this fix therefore led nowhere — see
    // patientInboxTargetUrl(), which repairs those at read time.
    targetUrl: `/patient/medication-plans/practice/${plan.id}`,
    sourceRefType: "medication_plan",
    sourceRefId: plan.id,
  });
}
