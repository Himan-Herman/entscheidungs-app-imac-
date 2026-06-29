import { prisma } from "../../lib/prisma.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import {
  hasPracticePermission,
  PERMISSIONS,
  canManageTeam,
} from "../../utils/practicePermissions.js";
import { memberProfileExtras } from "../../utils/practiceOrganizationJson.js";
import { writeAuditLog } from "../auditLogService.js";


function displayName(user, member) {
  if (member?.displayName) return member.displayName;
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : user?.email || "";
}

/**
 * @param {import('@prisma/client').PracticeMember & { user: object }} member
 * @param {boolean} publicView
 */
function doctorProfileJson(member, publicView = false) {
  const profile = memberProfileExtras(member);
  const base = {
    membershipId: member.id,
    userId: member.userId,
    role: member.role,
    displayName: displayName(member.user, member),
    doctorTitle: profile.doctorTitle,
    specialty: profile.specialty,
    focusArea: profile.focusArea,
    languages: profile.languages,
    officeHours: publicView ? profile.officeHours : profile.officeHours,
    visibleToPatients: profile.visibleToPatients,
    acceptsPatientRequests: profile.acceptsPatientRequests,
    onlineAppointmentsAvailable: profile.onlineAppointmentsAvailable,
    videoConsultationAvailable: profile.videoConsultationAvailable,
  };
  if (!publicView) {
    base.internalContact = profile.internalContact;
    base.positionTitle = profile.positionTitle;
  }
  return base;
}

/**
 * @param {string} practiceId
 */
export async function listPracticeDoctorsInternal(practiceId) {
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
  if (!practice) throw new Error("practice_not_found");

  const members = await prisma.practiceMember.findMany({
    where: {
      practiceProfileId: practiceId,
      status: "active",
      role: { in: ["doctor", "admin", "owner"] },
    },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const doctors = [];

  if (practice.user) {
    const ownerMember = members.find((m) => m.userId === practice.userId);
    doctors.push(
      doctorProfileJson(
        ownerMember || {
          id: `owner-${practice.userId}`,
          userId: practice.userId,
          role: "owner",
          user: practice.user,
          visibleToPatients: ownerMember?.visibleToPatients ?? false,
          acceptsPatientRequests: ownerMember?.acceptsPatientRequests ?? true,
          doctorTitle: ownerMember?.doctorTitle,
          specialty: ownerMember?.specialty || practice.specialty,
          focusArea: ownerMember?.focusArea,
          languagesJson: ownerMember?.languagesJson,
          officeHours: ownerMember?.officeHours,
          onlineAppointmentsAvailable: ownerMember?.onlineAppointmentsAvailable,
          videoConsultationAvailable: ownerMember?.videoConsultationAvailable,
          internalContact: ownerMember?.internalContact,
          positionTitle: ownerMember?.positionTitle,
          displayName: ownerMember?.displayName,
        },
        false,
      ),
    );
  }

  for (const m of members) {
    if (m.userId === practice.userId) continue;
    if (!["doctor", "admin"].includes(m.role)) continue;
    doctors.push(doctorProfileJson(m, false));
  }

  return { doctors };
}

/**
 * Public doctor list for patients (visible only).
 * @param {string} practiceId
 */
export async function listPublicPracticeDoctors(practiceId) {
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId, isActive: true },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!practice) throw new Error("practice_not_found");

  const members = await prisma.practiceMember.findMany({
    where: {
      practiceProfileId: practiceId,
      status: "active",
      visibleToPatients: true,
      acceptsPatientRequests: true,
      role: { in: ["doctor", "admin", "owner"] },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const doctors = [];
  for (const m of members) {
    doctors.push(doctorProfileJson(m, true));
  }

  const ownerVisible = members.some(
    (m) => m.userId === practice.userId && m.visibleToPatients,
  );
  if (
    practice.user &&
    ownerVisible &&
    !doctors.some((d) => d.userId === practice.userId)
  ) {
    const ownerMember = members.find((m) => m.userId === practice.userId);
    if (ownerMember) doctors.unshift(doctorProfileJson(ownerMember, true));
  }

  return {
    practiceId,
    practiceName: practice.displayNameForPatients || practice.practiceName,
    doctors: doctors.filter((d) => d.visibleToPatients && d.acceptsPatientRequests),
  };
}

/**
 * @param {string} actorUserId
 * @param {string} membershipId
 * @param {Record<string, unknown>} body
 * @param {{ req?: import('express').Request }} ctx
 */
export async function patchDoctorProfile(actorUserId, membershipId, body, ctx = {}) {
  const existing = await prisma.practiceMember.findUnique({
    where: { id: membershipId },
    include: { practiceProfile: true, user: true },
  });
  if (!existing) throw new Error("member_not_found");

  const practiceId = existing.practiceProfileId;
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("forbidden");

  const isSelf = existing.userId === actorUserId;
  const canEdit =
    canManageTeam(access.role) ||
    (isSelf && ["doctor", "owner", "admin"].includes(access.role));
  if (!canEdit) throw new Error("forbidden");

  const data = {};
  const changed = [];

  const boolFields = [
    "visibleToPatients",
    "acceptsPatientRequests",
    "onlineAppointmentsAvailable",
    "videoConsultationAvailable",
  ];
  for (const f of boolFields) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      data[f] = Boolean(body[f]);
      changed.push(f);
    }
  }

  const textFields = [
    "displayName",
    "positionTitle",
    "specialty",
    "doctorTitle",
    "focusArea",
    "officeHours",
    "internalContact",
  ];
  for (const f of textFields) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      const v = body[f];
      data[f] = v === null || v === "" ? null : String(v).trim().slice(0, 500);
      changed.push(f);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "languages")) {
    const langs = Array.isArray(body.languages)
      ? body.languages.map((x) => String(x).trim()).filter(Boolean)
      : [];
    data.languagesJson = langs.length ? JSON.stringify(langs) : null;
    changed.push("languages");
  }

  if (!Object.keys(data).length) throw new Error("validation_required");

  const row = await prisma.practiceMember.update({
    where: { id: membershipId },
    data,
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_doctor_profile_updated",
    entityType: "practice_membership",
    entityId: membershipId,
    practiceProfileId: practiceId,
    metadata: { fields: changed },
  });

  return doctorProfileJson(row, false);
}
