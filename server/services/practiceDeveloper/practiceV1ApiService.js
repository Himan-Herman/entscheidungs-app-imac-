import { PrismaClient } from "@prisma/client";
import { linkHasConsentType } from "../consent/consentRecordService.js";

const prisma = new PrismaClient();

export async function v1GetPracticeMe(practiceProfileId) {
  const p = await prisma.practiceProfile.findUnique({
    where: { id: practiceProfileId },
    select: {
      id: true,
      practiceName: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!p) throw new Error("not_found");
  return p;
}

export async function v1ListPatients(practiceProfileId) {
  const links = await prisma.practicePatientLink.findMany({
    where: { practiceProfileId, status: { in: ["invited", "active"] } },
    select: {
      id: true,
      status: true,
      patientUserId: true,
      linkedAt: true,
      updatedAt: true,
    },
    take: 500,
  });

  const out = [];
  for (const link of links) {
    const ok = await linkHasConsentType(link, "document_sharing");
    if (!ok) continue;
    out.push({
      linkId: link.id,
      status: link.status,
      linkedAt: link.linkedAt,
      updatedAt: link.updatedAt,
    });
  }
  return out;
}

export async function v1GetPatientLink(practiceProfileId, linkId) {
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
  });
  if (!link) throw new Error("not_found");
  const ok = await linkHasConsentType(link, "document_sharing");
  if (!ok) throw new Error("consent_required");
  return {
    linkId: link.id,
    status: link.status,
    linkedAt: link.linkedAt,
    updatedAt: link.updatedAt,
  };
}

export async function v1ListAppointments(practiceProfileId) {
  const rows = await prisma.practiceAppointment.findMany({
    where: { practiceProfileId },
    select: {
      id: true,
      title: true,
      status: true,
      startAt: true,
      endAt: true,
      locationType: true,
      practicePatientLinkId: true,
      createdAt: true,
    },
    orderBy: { startAt: "asc" },
    take: 200,
  });
  return rows;
}

export async function v1ListDocumentsMetadata(practiceProfileId) {
  const rows = await prisma.practiceDocument.findMany({
    where: { practiceProfileId, status: { not: "deleted" } },
    select: {
      id: true,
      type: true,
      title: true,
      status: true,
      practicePatientLinkId: true,
      createdAt: true,
      sharedAt: true,
    },
    take: 200,
  });
  return rows;
}

export async function v1ListMedicationPlansMetadata(practiceProfileId) {
  const rows = await prisma.medicationPlan.findMany({
    where: { practiceProfileId },
    select: {
      id: true,
      status: true,
      practicePatientLinkId: true,
      createdAt: true,
      publishedAt: true,
    },
    take: 200,
  });
  return rows;
}

export async function v1ListMessageThreadsMetadata(practiceProfileId) {
  const rows = await prisma.practicePatientThread.findMany({
    where: { practiceProfileId },
    select: {
      id: true,
      status: true,
      practicePatientLinkId: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 200,
  });
  return rows;
}

export async function v1ListDataRequests(practiceProfileId) {
  const rows = await prisma.patientDataRequest.findMany({
    where: { practiceProfileId },
    select: {
      id: true,
      status: true,
      requestType: true,
      practicePatientLinkId: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 200,
  });
  return rows;
}

export async function v1ListAuditMetadata(practiceProfileId) {
  const rows = await prisma.practiceApiAuditEvent.findMany({
    where: { practiceProfileId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      endpoint: true,
      statusCode: true,
      createdAt: true,
    },
  });
  return rows;
}
