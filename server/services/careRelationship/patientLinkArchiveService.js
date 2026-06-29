import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";
import { normalizeConsentScopes } from "./consentScopes.js";
import { linkToPatientJson } from "./practicePatientLinkService.js";
import { updatePatientProfileAccess } from "./practicePatientProfileService.js";


/**
 * Patient archives a practice relationship — revokes profile access and sets status archived.
 * @param {string} linkId
 * @param {string} patientUserId
 */
export async function archiveLinkForPatient(linkId, patientUserId) {
  const id = String(linkId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const link = await prisma.practicePatientLink.findFirst({
    where: { id, patientUserId: uid },
  });
  if (!link) throw new Error("link_not_found");
  if (link.status === "archived") throw new Error("link_already_archived");

  if (normalizeConsentScopes(link.consentScopes).includes("profile")) {
    await updatePatientProfileAccess(id, uid, false);
  }

  const now = new Date();
  const row = await prisma.practicePatientLink.update({
    where: { id },
    data: { status: "archived", updatedAt: now },
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
    action: "practice_patient_link_archived",
    entityType: "practice_patient_link",
    entityId: row.id,
    metadata: {
      practiceProfileId: row.practiceProfileId,
      patientUserId: row.patientUserId,
      practicePatientLinkId: row.id,
    },
  });

  return linkToPatientJson(row);
}
