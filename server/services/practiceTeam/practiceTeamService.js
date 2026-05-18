import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import {
  canManageTeam,
  getPracticeAccess,
  hasPracticePermission,
} from "../../utils/practiceAccess.js";
import {
  getPermissionMatrix,
  PERMISSIONS,
  PRACTICE_ROLES,
} from "../../utils/practicePermissions.js";

const prisma = new PrismaClient();

export const MEMBER_STATUSES = new Set(["invited", "active", "revoked"]);
export const ASSIGNABLE_ROLES = new Set(["admin", "doctor", "assistant", "viewer"]);

function isValidEmail(v) {
  if (!v || typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function userDisplayName(user) {
  if (!user) return null;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email;
}

/**
 * @param {import('@prisma/client').PracticeMember & { user?: { id: string, email: string, firstName: string, lastName: string } }} row
 * @param {{ isPracticeOwner?: boolean }} meta
 */
export function memberToJson(row, meta = {}) {
  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    invitedByUserId: row.invitedByUserId,
    invitedAt: row.invitedAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isPracticeOwner: Boolean(meta.isPracticeOwner),
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          displayName: userDisplayName(row.user),
        }
      : null,
  };
}

/**
 * @param {string} practiceId
 */
async function loadPractice(practiceId) {
  return prisma.practiceProfile.findUnique({
    where: { id: practiceId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
}

/**
 * @param {string} practiceId
 */
export async function buildTeamList(practiceId) {
  const practice = await loadPractice(practiceId);
  if (!practice) return null;

  const members = await prisma.practiceMember.findMany({
    where: { practiceProfileId: practiceId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const ownerUserId = practice.userId;
  const list = [];

  const ownerMemberRow = members.find((m) => m.userId === ownerUserId);
  if (practice.user) {
    list.push({
      id: ownerMemberRow?.id || `owner-${ownerUserId}`,
      practiceProfileId: practiceId,
      userId: ownerUserId,
      role: "owner",
      status: "active",
      invitedByUserId: null,
      invitedAt: null,
      acceptedAt: practice.createdAt,
      revokedAt: null,
      createdAt: practice.createdAt,
      updatedAt: practice.updatedAt,
      isPracticeOwner: true,
      user: {
        id: practice.user.id,
        email: practice.user.email,
        displayName: userDisplayName(practice.user),
      },
    });
  }

  for (const m of members) {
    if (m.userId === ownerUserId) continue;
    list.push(memberToJson(m));
  }

  return { practice, members: list };
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {{ req?: import('express').Request }} ctx
 */
export async function listPracticeTeam(actorUserId, practiceId, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !hasPracticePermission(access.role, PERMISSIONS.TEAM_VIEW)) {
    throw new Error("forbidden");
  }

  const built = await buildTeamList(practiceId);
  if (!built) throw new Error("practice_not_found");

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_team_list_viewed",
    entityType: "practice_membership",
    entityId: practiceId,
    practiceProfileId: practiceId,
    metadata: { memberCount: built.members.length },
  });

  return {
    practiceId,
    practiceName: built.practice.practiceName,
    role: access.role,
    canManage: canManageTeam(access.role),
    canViewAudit: hasPracticePermission(access.role, PERMISSIONS.AUDIT_VIEW),
    members: built.members,
    roles: PRACTICE_ROLES,
    statuses: [...MEMBER_STATUSES],
  };
}

export function getPracticePermissionsPayload(role) {
  return {
    role,
    permissions: getPermissionMatrix(),
    currentRolePermissions: getPermissionMatrix().find((r) => r.role === role)?.permissions || [],
  };
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {{ email?: string, userId?: string, role?: string }} input
 * @param {{ req?: import('express').Request }} ctx
 */
export async function invitePracticeTeamMember(actorUserId, practiceId, input, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageTeam(access.role)) throw new Error("forbidden");

  const role = String(input.role || "assistant").trim();
  if (!ASSIGNABLE_ROLES.has(role)) throw new Error("role_invalid");

  let targetUserId = String(input.userId || "").trim();
  const emailRaw = String(input.email || "").trim().toLowerCase();

  if (!targetUserId && emailRaw) {
    if (!isValidEmail(emailRaw)) throw new Error("email_invalid");
    const byEmail = await prisma.user.findUnique({
      where: { email: emailRaw },
      select: { id: true },
    });
    if (!byEmail) throw new Error("user_not_found");
    targetUserId = byEmail.id;
  }

  if (!targetUserId) throw new Error("validation_required");

  const practice = await loadPractice(practiceId);
  if (!practice) throw new Error("practice_not_found");
  if (practice.userId === targetUserId) throw new Error("cannot_invite_owner");

  const now = new Date();
  const row = await prisma.practiceMember.upsert({
    where: {
      practiceProfileId_userId: { practiceProfileId: practiceId, userId: targetUserId },
    },
    update: {
      role,
      status: "invited",
      invitedByUserId: actorUserId,
      invitedAt: now,
      revokedAt: null,
    },
    create: {
      practiceProfileId: practiceId,
      userId: targetUserId,
      role,
      status: "invited",
      invitedByUserId: actorUserId,
      invitedAt: now,
    },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_team_member_invited",
    entityType: "practice_membership",
    entityId: row.id,
    practiceProfileId: practiceId,
    metadata: { targetUserId, role, status: row.status },
  });

  return memberToJson(row);
}

/**
 * @param {string} actorUserId
 * @param {string} membershipId
 * @param {string} role
 * @param {{ req?: import('express').Request }} ctx
 */
export async function updatePracticeTeamMemberRole(actorUserId, membershipId, role, ctx = {}) {
  const existing = await prisma.practiceMember.findUnique({
    where: { id: membershipId },
    include: { practiceProfile: true },
  });
  if (!existing) throw new Error("member_not_found");

  const practiceId = existing.practiceProfileId;
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageTeam(access.role)) throw new Error("forbidden");

  const nextRole = String(role || "").trim();
  const allowedRoles = new Set([...ASSIGNABLE_ROLES, "admin"]);
  if (!allowedRoles.has(nextRole)) throw new Error("role_invalid");

  if (existing.practiceProfile.userId === existing.userId) {
    throw new Error("cannot_change_practice_owner");
  }

  if (existing.status === "revoked") throw new Error("member_revoked");

  if (access.role !== "owner" && (existing.role === "owner" || nextRole === "owner")) {
    throw new Error("forbidden_role_escalation");
  }

  const row = await prisma.practiceMember.update({
    where: { id: membershipId },
    data: { role: nextRole },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_team_member_role_changed",
    entityType: "practice_membership",
    entityId: row.id,
    practiceProfileId: practiceId,
    metadata: { previousRole: existing.role, newRole: nextRole },
  });

  return memberToJson(row);
}

/**
 * @param {string} actorUserId
 * @param {string} membershipId
 * @param {{ req?: import('express').Request }} ctx
 */
export async function revokePracticeTeamMember(actorUserId, membershipId, ctx = {}) {
  const existing = await prisma.practiceMember.findUnique({
    where: { id: membershipId },
    include: { practiceProfile: true },
  });
  if (!existing) throw new Error("member_not_found");

  const practiceId = existing.practiceProfileId;
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageTeam(access.role)) throw new Error("forbidden");

  if (existing.practiceProfile.userId === existing.userId) {
    throw new Error("cannot_revoke_practice_owner");
  }

  if (existing.userId === actorUserId) {
    throw new Error("cannot_revoke_self");
  }

  const now = new Date();
  const row = await prisma.practiceMember.update({
    where: { id: membershipId },
    data: { status: "revoked", revokedAt: now },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_team_member_revoked",
    entityType: "practice_membership",
    entityId: row.id,
    practiceProfileId: practiceId,
    metadata: { targetUserId: row.userId, role: row.role },
  });

  return memberToJson(row);
}

/**
 * @param {string} userId
 * @param {string} practiceId
 * @param {{ req?: import('express').Request }} ctx
 */
export async function acceptPracticeTeamInvite(userId, practiceId, ctx = {}) {
  const row = await prisma.practiceMember.findUnique({
    where: {
      practiceProfileId_userId: { practiceProfileId: practiceId, userId },
    },
  });
  if (!row) throw new Error("invite_not_found");
  if (row.status !== "invited") throw new Error("invite_not_pending");

  const now = new Date();
  const updated = await prisma.practiceMember.update({
    where: { id: row.id },
    data: { status: "active", acceptedAt: now },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  writeAuditLog({
    req: ctx.req,
    userId,
    actorRole: updated.role,
    action: "practice_team_invite_accepted",
    entityType: "practice_membership",
    entityId: updated.id,
    practiceProfileId: practiceId,
    metadata: { role: updated.role },
  });

  return memberToJson(updated);
}

/**
 * Pending invites for the current user.
 * @param {string} userId
 */
export async function listPendingInvitesForUser(userId) {
  const rows = await prisma.practiceMember.findMany({
    where: { userId, status: "invited" },
    include: {
      practiceProfile: { select: { id: true, practiceName: true } },
    },
    orderBy: { invitedAt: "desc" },
  });
  return rows.map((r) => ({
    membershipId: r.id,
    practiceProfileId: r.practiceProfileId,
    practiceName: r.practiceProfile?.practiceName || null,
    role: r.role,
    invitedAt: r.invitedAt,
  }));
}
