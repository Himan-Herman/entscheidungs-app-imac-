import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";
import {
  accessHasPermission,
  canManageTeam,
  getPracticeAccess,
  hasPracticePermission,
} from "../../utils/practiceAccess.js";
import {
  ASSIGNABLE_CLINICAL_ROLES,
  CLINICAL_ROLE_STATUSES,
  getPermissionMatrix,
  PERMISSIONS,
  PRACTICE_ROLES,
} from "../../utils/practicePermissions.js";
import { clinicalRoleCapabilities } from "./practiceClinicalRoleService.js";
import { memberProfileExtras } from "../../utils/practiceOrganizationJson.js";


export const MEMBER_STATUSES = new Set(["invited", "active", "revoked"]);
export const ASSIGNABLE_ROLES = new Set([
  "admin",
  "doctor",
  "secretary",
  "assistant",
  "practice_manager",
  "viewer",
]);

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
    // Organizational role — kept under `role` for API compatibility.
    role: row.role,
    organizationalRole: row.role,
    status: row.status,
    // Clinical role held in addition; null when none was ever requested.
    clinicalRole: row.clinicalRole ?? null,
    clinicalRoleStatus: row.clinicalRoleStatus ?? null,
    clinicalRoleRequestedAt: row.clinicalRoleRequestedAt ?? null,
    clinicalRoleApprovedAt: row.clinicalRoleApprovedAt ?? null,
    // Practice staff id of the approver — never a patient identifier.
    clinicalRoleApprovedByUserId: row.clinicalRoleApprovedByUserId ?? null,
    // Per-viewer capabilities so the UI never renders a self-approval control.
    capabilities: meta.capabilities ?? null,
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
    profile: memberProfileExtras(row),
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
    /**
     * The owner row goes through the SAME serializer as everyone else.
     *
     * It used to be assembled by hand, which silently dropped the clinical
     * role fields: the owner never saw their own request or approval, and an
     * approver never saw a pending owner request in the list. Spreading the
     * real membership row first keeps those fields (and only those — the
     * organizational identity below is still forced, because ownership comes
     * from PracticeProfile.userId and must not depend on the membership row).
     *
     * Nothing clinical is derived from ownership, `specialty` or `doctorTitle`:
     * the values come from the PracticeMember record or stay null.
     */
    const ownerRow = {
      ...(ownerMemberRow ?? {}),
      id: ownerMemberRow?.id || `owner-${ownerUserId}`,
      practiceProfileId: practiceId,
      userId: ownerUserId,
      // Organizational identity of the owner is fixed, not read from the row.
      role: "owner",
      status: "active",
      invitedByUserId: null,
      invitedAt: null,
      acceptedAt: ownerMemberRow?.acceptedAt ?? practice.createdAt,
      revokedAt: null,
      createdAt: ownerMemberRow?.createdAt ?? practice.createdAt,
      updatedAt: ownerMemberRow?.updatedAt ?? practice.updatedAt,
      user: practice.user,
    };
    list.push(memberToJson(ownerRow, { isPracticeOwner: true }));
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

  // Per-row capabilities are computed for THIS viewer, so the client never has
  // to decide who may approve — and can never render a self-approval control.
  const members = built.members.map((m) => ({
    ...m,
    capabilities: {
      ...clinicalRoleCapabilities(access, m),
      // The organizational counterpart to the clinical capabilities: the UI
      // never renders a role control the server would refuse. One's own row
      // and the owner's row are display-only.
      canChangeRole:
        canManageTeam(access.role)
        && !m.isPracticeOwner
        && m.status !== "revoked"
        && m.userId !== access.userId,
    },
  }));

  return {
    practiceId,
    practiceName: built.practice.practiceName,
    role: access.role,
    organizationalRole: access.organizationalRole ?? access.role,
    isOwner: Boolean(access.isOwner),
    clinicalRole: access.clinicalRole ?? null,
    clinicalRoleStatus: access.clinicalRoleStatus ?? null,
    canManage: canManageTeam(access.role),
    canManageClinicalRoles: accessHasPermission(access, PERMISSIONS.CLINICAL_ROLE_MANAGE),
    canViewAudit: hasPracticePermission(access.role, PERMISSIONS.AUDIT_VIEW),
    members,
    roles: PRACTICE_ROLES,
    statuses: [...MEMBER_STATUSES],
    clinicalRoles: [...ASSIGNABLE_CLINICAL_ROLES],
    clinicalRoleStatuses: [...CLINICAL_ROLE_STATUSES],
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
/**
 * The one rule every organizational role mutation must pass.
 *
 * Nobody changes their own membership — not to a higher role, not to a lower
 * one. A self-promotion is the obvious escalation; a self-demotion can remove
 * the last administrator, and both bypass the four-eyes principle the clinical
 * path already enforces. The owner is protected separately: ownership is a
 * property of the practice, not a membership role, and never changes here.
 *
 * Central on purpose: the team service AND the legacy member routes call this,
 * so the rule cannot drift apart between the two write paths.
 *
 * @param {{ actorUserId: string, targetMember: { userId: string, practiceProfile?: { userId?: string } | null } }} input
 */
export function assertPracticeMemberRoleMutationAllowed({ actorUserId, targetMember }) {
  if (!actorUserId || !targetMember) throw new Error("member_not_found");
  if (targetMember.practiceProfile && targetMember.practiceProfile.userId === targetMember.userId) {
    throw new Error("cannot_change_practice_owner");
  }
  if (targetMember.userId === actorUserId) {
    throw new Error("self_role_change_forbidden");
  }
}

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

  // The upsert below rewrites an existing membership's role and status.
  // Inviting YOURSELF is therefore a self role change with extra steps —
  // ASSIGNABLE_ROLES includes "admin", so without this a practice manager was
  // one self-invite and one self-accept away from admin.
  if (targetUserId === actorUserId) throw new Error("self_role_change_forbidden");

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

  // Owner protection and the self-change ban, from the one shared rule.
  assertPracticeMemberRoleMutationAllowed({ actorUserId, targetMember: existing });

  if (existing.status === "revoked") throw new Error("member_revoked");

  if (access.role !== "owner" && (existing.role === "owner" || nextRole === "owner")) {
    throw new Error("forbidden_role_escalation");
  }

  // Conditional on the state we validated: if a parallel change moved the role
  // or status in between, zero rows match and the caller gets a conflict
  // instead of silently overwriting the other change.
  const result = await prisma.practiceMember.updateMany({
    where: { id: membershipId, role: existing.role, status: existing.status },
    data: { role: nextRole },
  });
  if (result.count !== 1) throw new Error("role_state_conflict");

  const row = await prisma.practiceMember.findUnique({
    where: { id: membershipId },
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
