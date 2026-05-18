import { PrismaClient } from "@prisma/client";
import { isPracticeInboxEnabled } from "../../config/featureFlags.js";
import { upsertPracticeInboxItem } from "./practiceInboxService.js";

const prisma = new PrismaClient();

/**
 * @param {{ practiceProfileId: string, practicePatientLinkId?: string, patientUserId?: string, type: string, titleDe: string, titleEn: string, summaryDe?: string, summaryEn?: string, priority?: string, sourceRefType?: string, sourceRefId?: string, targetUrl?: string, lang?: string }} p
 */
async function notify(p) {
  if (!isPracticeInboxEnabled()) return null;
  try {
    const en = String(p.lang || "").toLowerCase().startsWith("en");
    return await upsertPracticeInboxItem({
      practiceProfileId: p.practiceProfileId,
      practicePatientLinkId: p.practicePatientLinkId,
      patientUserId: p.patientUserId,
      type: p.type,
      title: en ? p.titleEn : p.titleDe,
      summary: en ? p.summaryEn ?? p.summaryDe : p.summaryDe ?? p.summaryEn,
      priority: p.priority,
      sourceRefType: p.sourceRefType,
      sourceRefId: p.sourceRefId,
      targetUrl: p.targetUrl,
    });
  } catch (err) {
    console.error("[practice-inbox/notify]", err?.message ?? err);
    return null;
  }
}

/**
 * @param {{ id: string, practiceProfileId: string, practicePatientLinkId: string, patientUserId: string, subject?: string | null }} thread
 */
export async function notifyPracticeInboxOfPatientMessage(thread) {
  const linkId = thread.practicePatientLinkId;
  const targetUrl = linkId
    ? `/practice/patients/${linkId}?practiceId=${thread.practiceProfileId}&tab=messages`
    : null;

  return notify({
    practiceProfileId: thread.practiceProfileId,
    practicePatientLinkId: linkId,
    patientUserId: thread.patientUserId,
    type: "message",
    titleDe: "Neue Patientennachricht",
    titleEn: "New patient message",
    summaryDe: "Neue Nachricht im sicheren Bereich.",
    summaryEn: "New message in the secure workspace.",
    sourceRefType: "thread",
    sourceRefId: thread.id,
    targetUrl,
  });
}

/**
 * @param {{ id: string, practiceProfileId: string | null, practicePatientLinkId: string | null, patientUserId: string, type: string }} request
 */
export async function notifyPracticeInboxOfDataRequest(request) {
  if (!request.practiceProfileId) return null;

  const linkId = request.practicePatientLinkId;
  const targetUrl = linkId
    ? `/practice/patients/${linkId}?practiceId=${request.practiceProfileId}&tab=activity`
    : `/practice/data-requests?practiceId=${request.practiceProfileId}`;

  const typeLabel =
    request.type === "export"
      ? { de: "Export-Anfrage", en: "Export request" }
      : request.type === "access_restriction"
        ? { de: "Zugriffseinschränkung", en: "Access restriction" }
        : { de: "Löschanfrage", en: "Deletion request" };

  return notify({
    practiceProfileId: request.practiceProfileId,
    practicePatientLinkId: linkId || undefined,
    patientUserId: request.patientUserId,
    type: "data_request",
    titleDe: `Patienten-Datenanfrage: ${typeLabel.de}`,
    titleEn: `Patient data request: ${typeLabel.en}`,
    summaryDe: "Bitte organisatorisch prüfen — keine automatische Löschung.",
    summaryEn: "Please review operationally — no automatic deletion.",
    priority: "important",
    sourceRefType: "data_request",
    sourceRefId: request.id,
    targetUrl,
  });
}

/**
 * @param {{ id: string, practiceProfileId: string | null, patientUserId: string | null, preVisitSessionId: string, title?: string | null }} thread
 */
export async function notifyPracticeInboxOfFollowUpReply(thread) {
  if (!thread.practiceProfileId) return null;

  let linkId = null;
  if (thread.patientUserId) {
    const link = await prisma.practicePatientLink.findFirst({
      where: {
        practiceProfileId: thread.practiceProfileId,
        patientUserId: thread.patientUserId,
        status: { in: ["active", "invited"] },
      },
      select: { id: true },
    });
    linkId = link?.id;
  }

  const targetUrl = `/pre-visit/follow-ups?practiceId=${thread.practiceProfileId}`;

  return notify({
    practiceProfileId: thread.practiceProfileId,
    practicePatientLinkId: linkId || undefined,
    patientUserId: thread.patientUserId || undefined,
    type: "follow_up",
    titleDe: "Neue Pre-Visit-Rückfrage",
    titleEn: "New Pre-Visit follow-up reply",
    summaryDe: thread.title?.trim()
      ? `Thread: ${thread.title.trim().slice(0, 120)}`
      : "Patient:in hat auf eine Rückfrage geantwortet.",
    summaryEn: thread.title?.trim()
      ? `Thread: ${thread.title.trim().slice(0, 120)}`
      : "Patient replied to a follow-up question.",
    sourceRefType: "follow_up",
    sourceRefId: thread.id,
    targetUrl,
  });
}

/**
 * Neutral notice when a new preparation is submitted (optional hook).
 * @param {{ id: string, practiceProfileId: string, userId: string, title?: string | null }} session
 */
/**
 * Neutral inbox when patient asks about a published medication plan (no drug names in title).
 * @param {{ id: string, practiceProfileId: string, practicePatientLinkId: string, patientUserId: string }} plan
 */
/**
 * @param {{ id: string, practiceProfileId: string, practicePatientLinkId: string, patientUserId: string }} doc
 */
export async function notifyPracticeInboxOfDocumentQuestion(doc) {
  const linkId = doc.practicePatientLinkId;
  const targetUrl = linkId
    ? `/practice/patients/${linkId}?practiceId=${doc.practiceProfileId}&tab=documents`
    : null;

  return notify({
    practiceProfileId: doc.practiceProfileId,
    practicePatientLinkId: linkId,
    patientUserId: doc.patientUserId,
    type: "document",
    titleDe: "Rückfrage zu einem Praxisdokument",
    titleEn: "Question about a practice document",
    summaryDe: "Patient:in hat eine Rückfrage gestellt — bitte im sicheren Bereich bearbeiten.",
    summaryEn: "Patient asked a question — please handle in the secure workspace.",
    sourceRefType: "practice_document",
    sourceRefId: doc.id,
    targetUrl,
  });
}

export async function notifyPracticeInboxOfMedicationQuestion(plan) {
  const linkId = plan.practicePatientLinkId;
  const targetUrl = linkId
    ? `/practice/patients/${linkId}?practiceId=${plan.practiceProfileId}&tab=medication`
    : null;

  return notify({
    practiceProfileId: plan.practiceProfileId,
    practicePatientLinkId: linkId,
    patientUserId: plan.patientUserId,
    type: "medication",
    titleDe: "Rückfrage zu einer Medikationsinformation",
    titleEn: "Question about medication information",
    summaryDe: "Patient:in hat eine Rückfrage gestellt — bitte im sicheren Bereich bearbeiten.",
    summaryEn: "Patient asked a question — please handle in the secure workspace.",
    sourceRefType: "medication_plan",
    sourceRefId: plan.id,
    targetUrl,
  });
}

/**
 * @param {{ id: string, patientUserId: string, practiceProfileId: string }} link
 */
export async function notifyPracticeInboxOfProfileRevoked(link) {
  const linkId = link.id;
  const targetUrl = `/practice/patients/${linkId}?practiceId=${link.practiceProfileId}&tab=profile`;

  return notify({
    practiceProfileId: link.practiceProfileId,
    practicePatientLinkId: linkId,
    patientUserId: link.patientUserId,
    type: "profile",
    titleDe: "Profilfreigabe widerrufen",
    titleEn: "Profile sharing revoked",
    summaryDe: "Patient:in hat die Profilfreigabe beendet.",
    summaryEn: "Patient ended profile sharing.",
    sourceRefType: "practice_patient_link",
    sourceRefId: link.id,
    targetUrl,
  });
}

export async function notifyPracticeInboxOfPreVisitSubmission(session) {
  if (!session.practiceProfileId) return null;

  const link = await prisma.practicePatientLink.findFirst({
    where: {
      practiceProfileId: session.practiceProfileId,
      patientUserId: session.userId,
    },
    select: { id: true },
  });

  const targetUrl = `/practice/dashboard/preparations/${session.id}?practiceId=${session.practiceProfileId}`;

  return notify({
    practiceProfileId: session.practiceProfileId,
    practicePatientLinkId: link?.id,
    patientUserId: session.userId,
    type: "previsit",
    titleDe: "Neue Pre-Visit-Vorbereitung",
    titleEn: "New Pre-Visit preparation",
    summaryDe: session.title?.trim()
      ? `Titel: ${session.title.trim().slice(0, 120)}`
      : "Eine Vorbereitung wurde eingereicht.",
    summaryEn: session.title?.trim()
      ? `Title: ${session.title.trim().slice(0, 120)}`
      : "A preparation was submitted.",
    sourceRefType: "previsit_session",
    sourceRefId: session.id,
    targetUrl,
  });
}
