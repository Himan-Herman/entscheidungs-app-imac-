import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import {
  canManagePatientAssignment,
  canReadPracticePatientLinks,
  PERMISSIONS,
  hasPracticePermission,
} from "../../utils/practicePermissions.js";
import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
} from "../../utils/practiceOrganizationConstants.js";
import { assignmentExtras } from "../../utils/practiceOrganizationJson.js";
import { linkToJson } from "./practicePatientLinkService.js";

const prisma = new PrismaClient();

const linkInclude = {
  patientUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  patientProfile: {
    select: { id: true, displayName: true, relationLabel: true },
  },
  assignedDoctor: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  assignedTeamMember: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
};

/**
 * @param {import('@prisma/client').PracticePatientLink} row
 */
export function linkWithAssignmentJson(row) {
  return {
    ...linkToJson(row),
    assignment: assignmentExtras(row),
    assignedDoctor: row.assignedDoctor
      ? {
          id: row.assignedDoctor.id,
          displayName: [row.assignedDoctor.firstName, row.assignedDoctor.lastName]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    assignedTeamMember: row.assignedTeamMember
      ? {
          id: row.assignedTeamMember.id,
          displayName: [
            row.assignedTeamMember.firstName,
            row.assignedTeamMember.lastName,
          ]
            .filter(Boolean)
            .join(" "),
        }
      : null,
  };
}

/**
 * @param {string} practiceId
 * @param {string} userId
 */
async function assertActiveMember(practiceId, userId) {
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
    select: { userId: true },
  });
  if (!practice) throw new Error("practice_not_found");
  if (practice.userId === userId) return { role: "owner" };

  const member = await prisma.practiceMember.findFirst({
    where: {
      practiceProfileId: practiceId,
      userId,
      status: "active",
    },
    select: { role: true },
  });
  if (!member) throw new Error("assignee_not_member");
  return member;
}

/**
 * @param {string} linkId
 * @param {string} practiceId
 */
async function loadLink(linkId, practiceId) {
  const row = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, practiceProfileId: practiceId },
    include: linkInclude,
  });
  if (!row) throw new Error("link_not_found");
  return row;
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {string} linkId
 * @param {{ assigneeUserId: string, assignmentType?: string, note?: string }} input
 * @param {{ req?: import('express').Request }} ctx
 */
export async function assignPracticePatient(actorUserId, practiceId, linkId, input, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManagePatientAssignment(access.role)) {
    throw new Error("forbidden");
  }

  const assigneeUserId = String(input.assigneeUserId || "").trim();
  if (!assigneeUserId) throw new Error("validation_required");

  const assignmentType = String(input.assignmentType || "team").trim();
  if (!ASSIGNMENT_TYPES.has(assignmentType)) throw new Error("assignmentType_invalid");

  await assertActiveMember(practiceId, assigneeUserId);
  const existing = await loadLink(linkId, practiceId);
  const now = new Date();

  const data = {
    assignmentStatus: "assigned",
    assignedByUserId: actorUserId,
    assignedAt: now,
    assignmentNote: input.note ? String(input.note).trim().slice(0, 500) : null,
  };

  if (assignmentType === "doctor") {
    data.assignedDoctorUserId = assigneeUserId;
    data.assignedTeamMemberUserId = null;
  } else {
    data.assignedTeamMemberUserId = assigneeUserId;
    if (assignmentType === "secretary") {
      data.assignedDoctorUserId = existing.assignedDoctorUserId;
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.practicePatientAssignment.updateMany({
      where: { practicePatientLinkId: linkId, status: "active" },
      data: { status: "revoked", revokedAt: now },
    });

    await tx.practicePatientAssignment.create({
      data: {
        practicePatientLinkId: linkId,
        assignedToUserId: assigneeUserId,
        assignedByUserId: actorUserId,
        assignmentType,
        status: "active",
        note: data.assignmentNote,
      },
    });

    return tx.practicePatientLink.update({
      where: { id: linkId },
      data,
      include: linkInclude,
    });
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_patient_assigned",
    entityType: "PracticePatientLink",
    entityId: linkId,
    practiceProfileId: practiceId,
    metadata: {
      assigneeUserId,
      assignmentType,
      assignmentStatus: row.assignmentStatus,
    },
  });

  return linkWithAssignmentJson(row);
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {string} linkId
 * @param {{ req?: import('express').Request }} ctx
 */
export async function unassignPracticePatient(actorUserId, practiceId, linkId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManagePatientAssignment(access.role)) {
    throw new Error("forbidden");
  }

  await loadLink(linkId, practiceId);
  const now = new Date();

  const row = await prisma.$transaction(async (tx) => {
    await tx.practicePatientAssignment.updateMany({
      where: { practicePatientLinkId: linkId, status: "active" },
      data: { status: "revoked", revokedAt: now },
    });

    return tx.practicePatientLink.update({
      where: { id: linkId },
      data: {
        assignmentStatus: "unassigned",
        assignedDoctorUserId: null,
        assignedTeamMemberUserId: null,
        assignedByUserId: null,
        assignedAt: null,
        assignmentNote: null,
      },
      include: linkInclude,
    });
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_patient_unassigned",
    entityType: "PracticePatientLink",
    entityId: linkId,
    practiceProfileId: practiceId,
    metadata: {},
  });

  return linkWithAssignmentJson(row);
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {string} linkId
 * @param {{ assigneeUserId: string, assignmentType?: string, note?: string }} input
 * @param {{ req?: import('express').Request }} ctx
 */
export async function forwardPracticePatient(actorUserId, practiceId, linkId, input, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManagePatientAssignment(access.role)) {
    throw new Error("forbidden");
  }

  const result = await assignPracticePatient(actorUserId, practiceId, linkId, input, ctx);

  const row = await prisma.practicePatientLink.update({
    where: { id: linkId },
    data: {
      assignmentStatus: "forwarded",
      lastForwardedAt: new Date(),
    },
    include: linkInclude,
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_patient_forwarded",
    entityType: "PracticePatientLink",
    entityId: linkId,
    practiceProfileId: practiceId,
    metadata: { assigneeUserId: input.assigneeUserId },
  });

  return linkWithAssignmentJson(row);
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 */
export async function listAssignedToMe(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    throw new Error("forbidden");
  }

  const rows = await prisma.practicePatientLink.findMany({
    where: {
      practiceProfileId: practiceId,
      status: { in: ["invited", "active"] },
      OR: [
        { assignedDoctorUserId: actorUserId },
        { assignedTeamMemberUserId: actorUserId },
        { patientSelectedDoctorUserId: actorUserId },
      ],
    },
    include: linkInclude,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return { items: rows.map(linkWithAssignmentJson) };
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 */
export async function listUnassignedPatients(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !hasPracticePermission(access.role, PERMISSIONS.PATIENT_ASSIGNMENT_MANAGE)) {
    throw new Error("forbidden");
  }

  const rows = await prisma.practicePatientLink.findMany({
    where: {
      practiceProfileId: practiceId,
      status: { in: ["invited", "active"] },
      assignmentStatus: { in: ["unassigned", "forwarded"] },
      assignedDoctorUserId: null,
    },
    include: linkInclude,
    orderBy: { linkedAt: "desc" },
    take: 200,
  });

  return { items: rows.map(linkWithAssignmentJson) };
}

/**
 * @param {string} practiceId
 * @param {string} linkId
 */
export async function listAssignmentHistory(practiceId, linkId) {
  const rows = await prisma.practicePatientAssignment.findMany({
    where: { practicePatientLinkId: linkId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      assignedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    assignedToUserId: r.assignedToUserId,
    assignedByUserId: r.assignedByUserId,
    assignmentType: r.assignmentType,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt,
    revokedAt: r.revokedAt,
    assignedTo: r.assignedTo
      ? {
          id: r.assignedTo.id,
          displayName: [r.assignedTo.firstName, r.assignedTo.lastName]
            .filter(Boolean)
            .join(" "),
        }
      : null,
  }));
}

/**
 * Patient selects a doctor for a practice link.
 * @param {string} patientUserId
 * @param {string} practiceId
 * @param {{ doctorUserId?: string | null }} input
 */
export async function patientSelectPracticeDoctor(patientUserId, practiceId, input) {
  const doctorUserId = input.doctorUserId ? String(input.doctorUserId).trim() : null;

  const link = await prisma.practicePatientLink.findFirst({
    where: {
      practiceProfileId: practiceId,
      patientUserId,
      status: { in: ["invited", "active"] },
    },
  });
  if (!link) throw new Error("link_not_found");

  if (doctorUserId) {
    const member = await prisma.practiceMember.findFirst({
      where: {
        practiceProfileId: practiceId,
        userId: doctorUserId,
        status: "active",
        role: { in: ["doctor", "owner", "admin"] },
        visibleToPatients: true,
        acceptsPatientRequests: true,
      },
    });
    const practice = await prisma.practiceProfile.findUnique({
      where: { id: practiceId },
      select: { userId: true },
    });
    const isOwnerDoctor = practice?.userId === doctorUserId;
    if (!member && !isOwnerDoctor) throw new Error("doctor_not_available");
  }

  const now = new Date();
  const data = {
    patientSelectedDoctorUserId: doctorUserId,
    updatedAt: now,
  };

  if (doctorUserId) {
    data.assignedDoctorUserId = doctorUserId;
    data.assignmentStatus = "assigned";
    data.assignedAt = now;
  } else {
    data.assignmentStatus = "unassigned";
    data.assignedDoctorUserId = null;
    data.assignedTeamMemberUserId = null;
  }

  const row = await prisma.practicePatientLink.update({
    where: { id: link.id },
    data,
    include: linkInclude,
  });

  writeAuditLog({
    userId: patientUserId,
    actorRole: "patient",
    action: doctorUserId
      ? "patient_practice_doctor_selected"
      : "patient_practice_general_contact",
    entityType: "PracticePatientLink",
    entityId: link.id,
    practiceProfileId: practiceId,
    metadata: { doctorUserId: doctorUserId || null },
  });

  return linkWithAssignmentJson(row);
}
