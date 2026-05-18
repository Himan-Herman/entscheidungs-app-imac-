import { PrismaClient } from "@prisma/client";
import { isPatientInboxEnabled } from "../../config/featureFlags.js";
import { createInboxItem } from "../patientInbox/patientInboxService.js";

const prisma = new PrismaClient();

export const INBOX_MESSAGE_TITLE_DE = "Neue Nachricht von Ihrer Praxis";
export const INBOX_MESSAGE_TITLE_EN = "New message from your practice";

/**
 * @param {string} [lang]
 */
export function inboxMessageTitleForLanguage(lang) {
  return String(lang || "").toLowerCase().startsWith("en")
    ? INBOX_MESSAGE_TITLE_EN
    : INBOX_MESSAGE_TITLE_DE;
}

/**
 * Create neutral inbox item when practice sends a message (no body in title/summary).
 * @param {{ id: string, patientUserId: string, practiceProfileId: string, practicePatientLinkId: string }} thread
 */
export async function notifyPatientInboxOfPracticeMessage(thread) {
  if (!isPatientInboxEnabled()) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: thread.patientUserId },
      include: { profile: true },
    });
    const practice = await prisma.practiceProfile.findUnique({
      where: { id: thread.practiceProfileId },
      select: { practiceName: true },
    });

    const lang = user?.profile?.preferredPatientLanguage;
    const title = inboxMessageTitleForLanguage(lang);

    return await createInboxItem({
      patientUserId: thread.patientUserId,
      practiceProfileId: thread.practiceProfileId,
      practicePatientLinkId: thread.practicePatientLinkId,
      type: "message",
      title,
      sourceLabel: practice?.practiceName ?? null,
      targetUrl: `/patient/messages/${thread.id}`,
    });
  } catch (err) {
    console.error("[communication/inbox-notify]", err?.message ?? err);
    return null;
  }
}
