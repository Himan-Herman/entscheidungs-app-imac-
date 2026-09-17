import { prisma } from "../../lib/prisma.js";
import { writeRequiredAuditLog } from "../auditLogService.js";
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

  // Ending a care relationship must not be possible without a record of it, so
  // the status change and its mandatory audit commit together.
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.practicePatientLink.update({
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

    // Identifiers and the transition only — no consent scopes, no practice name,
    // no medical context.
    await writeRequiredAuditLog(
      {
        userId: uid,
        actorRole: "patient",
        action: "practice_patient_link_archived",
        entityType: "practice_patient_link",
        entityId: updated.id,
        practiceProfileId: updated.practiceProfileId,
        patientUserId: updated.patientUserId,
        practicePatientLinkId: updated.id,
        metadata: { previousStatus: link.status, newStatus: "archived" },
      },
      tx,
    );

    return updated;
  });

  return linkToPatientJson(row);
}
