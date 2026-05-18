import { notifyPatientInbox } from "../patientInbox/patientInboxNotify.js";

/**
 * @param {{ id: string, patientUserId: string, practiceProfileId: string, practicePatientLinkId: string }} doc
 */
export async function notifyPatientInboxOfPracticeDocument(doc) {
  return notifyPatientInbox({
    patientUserId: doc.patientUserId,
    practiceProfileId: doc.practiceProfileId,
    practicePatientLinkId: doc.practicePatientLinkId,
    type: "document",
    titleKey: "document",
    targetUrl: `/patient/practice-documents/${doc.id}`,
  });
}
