import { prisma } from "../../lib/prisma.js";
import { notifyPracticeInboxOfDocumentQuestion } from "../practiceInbox/practiceInboxNotify.js";
import { getSharedDocumentForPatient } from "./practiceDocumentService.js";


/**
 * Patient question about a shared document — neutral practice inbox only.
 * @param {string} documentId
 * @param {string} patientUserId
 */
export async function submitPatientPracticeDocumentQuestion(
  documentId,
  patientUserId,
) {
  const doc = await getSharedDocumentForPatient(documentId, patientUserId);

  const link = await prisma.practicePatientLink.findFirst({
    where: {
      id: doc.practicePatientLinkId,
      patientUserId,
      practiceProfileId: doc.practiceProfileId,
    },
    select: { id: true, status: true },
  });
  if (!link || !["active", "invited"].includes(link.status)) {
    throw new Error("link_not_active");
  }

  await notifyPracticeInboxOfDocumentQuestion({
    id: doc.id,
    practiceProfileId: doc.practiceProfileId,
    practicePatientLinkId: doc.practicePatientLinkId,
    patientUserId: doc.patientUserId,
  });

  return { ok: true, documentId: doc.id };
}
