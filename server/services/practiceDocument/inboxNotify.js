import { PrismaClient } from "@prisma/client";
import { isPatientInboxEnabled } from "../../config/featureFlags.js";
import { createInboxItem } from "../patientInbox/patientInboxService.js";

const prisma = new PrismaClient();

export const INBOX_DOCUMENT_TITLE_DE = "Neues Dokument von Ihrer Praxis";
export const INBOX_DOCUMENT_TITLE_EN = "New document from your practice";

export function inboxDocumentTitleForLanguage(lang) {
  return String(lang || "").toLowerCase().startsWith("en")
    ? INBOX_DOCUMENT_TITLE_EN
    : INBOX_DOCUMENT_TITLE_DE;
}

/**
 * @param {{ id: string, patientUserId: string, practiceProfileId: string, practicePatientLinkId: string }} doc
 */
export async function notifyPatientInboxOfPracticeDocument(doc) {
  if (!isPatientInboxEnabled()) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: doc.patientUserId },
      include: { profile: true },
    });
    const practice = await prisma.practiceProfile.findUnique({
      where: { id: doc.practiceProfileId },
      select: { practiceName: true },
    });

    const title = inboxDocumentTitleForLanguage(
      user?.profile?.preferredPatientLanguage,
    );

    return await createInboxItem({
      patientUserId: doc.patientUserId,
      practiceProfileId: doc.practiceProfileId,
      practicePatientLinkId: doc.practicePatientLinkId,
      type: "document",
      title,
      sourceLabel: practice?.practiceName ?? null,
      targetUrl: `/patient/practice-documents/${doc.id}`,
    });
  } catch (err) {
    console.error("[practice-document/inbox-notify]", err?.message ?? err);
    return null;
  }
}
