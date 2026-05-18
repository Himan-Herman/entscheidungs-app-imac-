import { PrismaClient } from "@prisma/client";
import { linkHasConsentScope } from "../careRelationship/consentScopes.js";
import { linkToPatientJson } from "../careRelationship/practicePatientLinkService.js";
import { listPatientDataRequests } from "./patientDataRequestService.js";

const prisma = new PrismaClient();

/**
 * @param {Date[]} dates
 */
function maxDate(dates) {
  let max = null;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (!max || t > max.getTime()) max = d;
  }
  return max;
}

/**
 * @param {import("@prisma/client").PracticePatientLink} link
 */
async function buildControlItem(link) {
  const linkId = link.id;

  const [medCount, docCount, threadCount, latestMed, latestDoc, latestThread, openRequests] =
    await Promise.all([
      prisma.medicationPlan.count({
        where: {
          practicePatientLinkId: linkId,
          patientUserId: link.patientUserId,
          status: "published",
        },
      }),
      prisma.practiceDocument.count({
        where: {
          practicePatientLinkId: linkId,
          patientUserId: link.patientUserId,
          status: "shared",
        },
      }),
      prisma.practicePatientThread.count({
        where: { practicePatientLinkId: linkId },
      }),
      prisma.medicationPlan.findFirst({
        where: { practicePatientLinkId: linkId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.practiceDocument.findFirst({
        where: { practicePatientLinkId: linkId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.practicePatientThread.findFirst({
        where: { practicePatientLinkId: linkId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.patientDataRequest.findMany({
        where: {
          practicePatientLinkId: linkId,
          status: { in: ["submitted", "in_review"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, status: true, createdAt: true },
      }),
    ]);

  const base = linkToPatientJson(link);

  return {
    ...base,
    profileAccessGranted: linkHasConsentScope(link, "profile"),
    profileAccessGrantedAt: link.profileAccessGrantedAt,
    profileAccessRevokedAt: link.profileAccessRevokedAt,
    hasMedicationPlans: medCount > 0,
    hasDocuments: docCount > 0,
    hasMessages: threadCount > 0,
    counts: {
      medicationPlans: medCount,
      documents: docCount,
      messages: threadCount,
    },
    lastActivityAt: maxDate([
      link.updatedAt,
      latestMed?.updatedAt,
      latestDoc?.updatedAt,
      latestThread?.updatedAt,
    ]),
    openDataRequests: openRequests,
    openDataRequest: openRequests[0] || null,
  };
}

/**
 * @param {string} patientUserId
 */
export async function getPatientDataControl(patientUserId) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const links = await prisma.practicePatientLink.findMany({
    where: { patientUserId: uid },
    include: {
      practiceProfile: {
        select: {
          id: true,
          practiceName: true,
          publicSlug: true,
          specialty: true,
        },
      },
      patientProfile: {
        select: { id: true, displayName: true, relationLabel: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const [practices, requests] = await Promise.all([
    Promise.all(links.map((l) => buildControlItem(l))),
    listPatientDataRequests(uid),
  ]);
  return { practices, requests };
}
