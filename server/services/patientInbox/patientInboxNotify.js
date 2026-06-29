import { prisma } from "../../lib/prisma.js";
import { isPatientInboxEnabled } from "../../config/featureFlags.js";
import {
  patientInboxTitleForType,
  PATIENT_INBOX_TITLES,
} from "../../constants/inboxNotificationCatalog.js";
import { upsertPatientInboxItem } from "./patientInboxService.js";


/**
 * @param {{
 *   patientUserId: string,
 *   practiceProfileId?: string,
 *   practicePatientLinkId?: string,
 *   type: string,
 *   titleKey?: string,
 *   title?: string,
 *   summaryKey?: string,
 *   summary?: string,
 *   targetUrl?: string,
 *   sourceLabel?: string,
 *   sourceRefType?: string,
 *   sourceRefId?: string,
 *   dedupeKey?: string,
 * }} p
 */
export async function notifyPatientInbox(p) {
  if (!isPatientInboxEnabled()) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: p.patientUserId },
      include: { profile: true },
    });
    const lang = user?.profile?.preferredPatientLanguage;
    const catalog = PATIENT_INBOX_TITLES[p.type] || PATIENT_INBOX_TITLES.system;
    const titleKey = p.titleKey || catalog.titleKey;

    let sourceLabel = p.sourceLabel;
    if (!sourceLabel && p.practiceProfileId) {
      const practice = await prisma.practiceProfile.findUnique({
        where: { id: p.practiceProfileId },
        select: { practiceName: true },
      });
      sourceLabel = practice?.practiceName ?? null;
    }

    const { item } = await upsertPatientInboxItem({
      patientUserId: p.patientUserId,
      practiceProfileId: p.practiceProfileId,
      practicePatientLinkId: p.practicePatientLinkId,
      type: p.type,
      titleKey,
      title: p.title || patientInboxTitleForType(p.type, lang),
      summaryKey: p.summaryKey,
      summary: p.summary,
      sourceLabel,
      targetUrl: p.targetUrl,
      sourceRefType: p.sourceRefType,
      sourceRefId: p.sourceRefId,
      dedupeKey: p.dedupeKey,
    });
    return item;
  } catch (err) {
    console.error("[patient-inbox/notify]", err?.message ?? err);
    return null;
  }
}

/**
 * @param {{ id: string, patientUserId: string, practiceProfileId: string | null, practicePatientLinkId: string | null, type: string, status: string }} request
 * @param {string} previousStatus
 */
export async function notifyPatientInboxOfDataRequestStatus(request, previousStatus) {
  void previousStatus;
  if (!request.practiceProfileId) return null;
  const linkId = request.practicePatientLinkId;
  const targetUrl = linkId
    ? `/patient/data-control?linkId=${linkId}`
    : "/patient/data-control";

  const summaryDe = "Status Ihrer organisatorischen Anfrage wurde aktualisiert.";
  const summaryEn = "Status of your organizational request was updated.";

  return notifyPatientInbox({
    patientUserId: request.patientUserId,
    practiceProfileId: request.practiceProfileId,
    practicePatientLinkId: linkId || undefined,
    type: "data_request",
    titleKey: "data_request_status",
    summaryKey: "data_request_status",
    summary: summaryDe,
    targetUrl,
    sourceRefType: "data_request",
    sourceRefId: request.id,
  });
}

/**
 * @param {{ id: string, patientUserId: string, practiceProfileId: string, practicePatientLinkId?: string }} link
 * @param {boolean} granted
 */
export async function notifyPatientInboxOfProfileAccess(link, granted) {
  const targetUrl = `/patient/data-control?linkId=${link.id}`;
  return notifyPatientInbox({
    patientUserId: link.patientUserId,
    practiceProfileId: link.practiceProfileId,
    practicePatientLinkId: link.id,
    type: "profile",
    titleKey: granted ? "profile_granted" : "profile_revoked",
    targetUrl,
    sourceRefType: "practice_patient_link",
    sourceRefId: link.id,
  });
}
