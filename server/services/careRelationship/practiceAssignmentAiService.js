import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManagePatientAssignment } from "../../utils/practicePermissions.js";
import { listPublicPracticeDoctors } from "../practiceTeam/practiceDoctorsService.js";


/**
 * Organizational assignment suggestion only — language, patient-selected doctor, no clinical logic.
 */
export async function generateOrganizationalAssignmentSuggestion(
  actorUserId,
  practiceId,
  linkId,
  { locale = "de" } = {},
  ctx = {},
) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManagePatientAssignment(access.role)) {
    throw new Error("forbidden");
  }

  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId: practiceId },
    select: {
      id: true,
      patientSelectedDoctorUserId: true,
      assignmentStatus: true,
      patientUser: { select: { profile: { select: { uiLanguage: true } } } },
    },
  });
  if (!link) throw new Error("link_not_found");

  const { doctors } = await listPublicPracticeDoctors(practiceId);
  const isDe = String(locale || "de").startsWith("de");

  let suggestedUserId = null;
  let reasonKey = "suggest_secretary_queue";

  if (link.patientSelectedDoctorUserId) {
    const picked = doctors.find((d) => d.userId === link.patientSelectedDoctorUserId);
    if (picked) {
      suggestedUserId = picked.userId;
      reasonKey = "suggest_patient_selected_doctor";
    }
  }

  const patientLang = link.patientUser?.profile?.uiLanguage;
  if (!suggestedUserId && patientLang && doctors.length) {
    const langMatch = doctors.find((d) =>
      (d.languages || []).map((l) => l.toLowerCase()).includes(String(patientLang).toLowerCase()),
    );
    if (langMatch) {
      suggestedUserId = langMatch.userId;
      reasonKey = "suggest_language_match";
    }
  }

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_patient_ai_assignment_suggestion",
    entityType: "PracticePatientLink",
    entityId: linkId,
    practiceProfileId: practiceId,
    metadata: { reasonKey, hasSuggestion: Boolean(suggestedUserId) },
  });

  const reasons = {
    suggest_patient_selected_doctor: isDe
      ? "Patient:in hat eine Ärztin / einen Arzt gewählt."
      : "Patient selected a specific doctor.",
    suggest_language_match: isDe
      ? "Sprachübereinstimmung mit einem sichtbaren Teamprofil."
      : "Language match with a visible team profile.",
    suggest_secretary_queue: isDe
      ? "Allgemeines Praxis-Postfach / Sekretariat empfohlen."
      : "General practice inbox / secretary queue recommended.",
  };

  return {
    aiSuggestionLabel: isDe ? "Automatischer Vorschlag – bitte prüfen" : "AI suggestion – please review",
    aiDisclaimer: isDe
      ? "Unterstützt nur organisatorisch, z. B. bei Sprache, Terminart oder Zuständigkeit. Keine medizinische Entscheidung."
      : "AI only supports organizational tasks, such as language, appointment type, or responsibility. It does not make medical decisions.",
    suggestedAssigneeUserId: suggestedUserId,
    suggestedAssignmentType: suggestedUserId ? "doctor" : "secretary",
    reason: reasons[reasonKey] || reasons.suggest_secretary_queue,
    reasonKey,
    isAiGenerated: true,
  };
}
