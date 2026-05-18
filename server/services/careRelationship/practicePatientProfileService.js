import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import { linkHasConsentScope } from "./consentScopes.js";
import { linkToPatientJson } from "./practicePatientLinkService.js";

const prisma = new PrismaClient();

const LINK_READABLE = new Set(["invited", "active"]);

async function assertLinkForPractice(linkId, practiceProfileId) {
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
  });
  if (!link) throw new Error("link_not_found");
  if (!LINK_READABLE.has(link.status)) throw new Error("link_not_active");
  return link;
}

function fmtDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * @param {import("@prisma/client").PracticePatientLink} link
 */
export function practiceHasProfileAccess(link) {
  if (!LINK_READABLE.has(link.status)) return false;
  return linkHasConsentScope(link, "profile");
}

/**
 * Read-only profile for practice (live data, no copy).
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} viewerUserId
 */
export async function getPatientProfileForPractice(
  linkId,
  practiceProfileId,
  viewerUserId,
) {
  await assertLinkForPractice(linkId, practiceProfileId);
  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId },
  });
  if (!link) throw new Error("link_not_found");
  if (!practiceHasProfileAccess(link)) throw new Error("profile_access_denied");

  const user = await prisma.user.findUnique({
    where: { id: link.patientUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      profile: true,
    },
  });
  if (!user) throw new Error("patient_not_found");

  let dependent = null;
  if (link.patientProfileId) {
    dependent = await prisma.patientProfile.findFirst({
      where: { id: link.patientProfileId, userId: link.patientUserId },
      select: {
        id: true,
        displayName: true,
        relationLabel: true,
        dateOfBirth: true,
        genderOrSalutation: true,
        preferredPatientLanguage: true,
      },
    });
  }

  const profile = user.profile;

  await writeAuditLog({
    userId: viewerUserId,
    actorRole: "practice",
    action: "profile_viewed",
    entityType: "PracticePatientLink",
    entityId: link.id,
    metadata: {
      practiceProfileId: link.practiceProfileId,
      patientUserId: link.patientUserId,
      hasDependentProfile: Boolean(dependent),
    },
  });

  return {
    linkId: link.id,
    practiceProfileId: link.practiceProfileId,
    patientUserId: link.patientUserId,
    dataSource: "patient_provided",
    basic: {
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: profile?.displayName || null,
      dateOfBirth: fmtDate(user.dateOfBirth),
      preferredLanguage: profile?.preferredPatientLanguage || null,
      genderOrSalutation: profile?.genderOrSalutation || profile?.gender || null,
      emergencyContactNote: profile?.emergencyNote || null,
      insuranceType: profile?.insuranceType || null,
    },
    health: dependent
      ? null
      : {
          allergies: profile?.allergies || null,
          regularMedications: profile?.regularMedications || null,
          chronicConditions: profile?.chronicConditions || null,
          importantNotes: profile?.emergencyNote || null,
        },
    dependentProfile: dependent
      ? {
          displayName: dependent.displayName,
          relationLabel: dependent.relationLabel,
          dateOfBirth: fmtDate(dependent.dateOfBirth),
          preferredLanguage: dependent.preferredPatientLanguage || null,
          genderOrSalutation: dependent.genderOrSalutation || null,
        }
      : null,
  };
}

/**
 * @param {string} linkId
 * @param {string} patientUserId
 * @param {boolean} granted
 */
export async function updatePatientProfileAccess(linkId, patientUserId, granted) {
  const id = String(linkId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const link = await prisma.practicePatientLink.findFirst({
    where: { id, patientUserId: uid },
  });
  if (!link) throw new Error("link_not_found");
  if (link.status === "revoked" || link.status === "archived") {
    throw new Error("link_not_active");
  }

  const now = new Date();
  let scopes = normalizeConsentScopes(link.consentScopes);

  if (
    link.consentAcceptedAt &&
    (!Array.isArray(link.consentScopes) || link.consentScopes.length === 0)
  ) {
    scopes = normalizeConsentScopes(["medication", "messages"]);
  }

  if (granted) {
    if (!scopes.includes("profile")) scopes.push("profile");
  } else {
    scopes = scopes.filter((s) => s !== "profile");
  }

  const data = {
    consentScopes: scopes,
    updatedAt: now,
  };

  if (granted && !link.consentAcceptedAt) {
    data.consentAcceptedAt = now;
    data.consentVersion = link.consentVersion || CARE_CONSENT_VERSION;
    if (link.status === "invited") data.status = "active";
  }

  const row = await prisma.practicePatientLink.update({
    where: { id },
    data,
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
  });

  await writeAuditLog({
    userId: uid,
    actorRole: "patient",
    action: granted ? "profile_access_granted" : "profile_access_revoked",
    entityType: "PracticePatientLink",
    entityId: row.id,
    metadata: {
      practiceProfileId: row.practiceProfileId,
      patientUserId: row.patientUserId,
    },
  });

  return linkToPatientJson(row);
}
