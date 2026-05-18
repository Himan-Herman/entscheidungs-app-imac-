import { notifyPatientInbox } from "../patientInbox/patientInboxNotify.js";

/**
 * Create neutral inbox item when practice sends a message (no body in title/summary).
 * @param {{ id: string, patientUserId: string, practiceProfileId: string, practicePatientLinkId: string }} thread
 */
export async function notifyPatientInboxOfPracticeMessage(thread) {
  return notifyPatientInbox({
    patientUserId: thread.patientUserId,
    practiceProfileId: thread.practiceProfileId,
    practicePatientLinkId: thread.practicePatientLinkId,
    type: "message",
    titleKey: "message",
    targetUrl: `/patient/messages/${thread.id}`,
    sourceRefType: "patient_thread",
    sourceRefId: thread.id,
  });
}
