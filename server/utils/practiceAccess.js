import { prisma } from "../lib/prisma.js";
import {
  hasPracticePermission,
  permissionsForRole,
  clinicalPermissionsForRole,
} from "./practicePermissions.js";


export {
  canAccessPracticeDataApi,
  canManageIntegrations,
  canManageTeam,
  canReadPracticePatientLinks,
  canViewIntegrationSettings,
  canWritePracticePatientLinks,
  hasPracticePermission,
  PERMISSIONS,
} from "./practicePermissions.js";

export {
  canPracticeArchive,
  canPracticeSoftDelete,
  canPracticeRestoreFromArchive,
} from "./lifecycleAccess.js";

/**
 * Effective practice authorization for a user.
 *
 * ORGANIZATIONAL vs OCCUPATIONAL ROLE
 * -----------------------------------
 * `isOwner` (from PracticeProfile.userId) is an organizational property: it
 * grants administrative power over the tenant, never clinical access.
 * `membershipRole` (from an ACTIVE PracticeMember row) is the operational /
 * occupational role and is the only source of clinical permissions.
 *
 * A third, independent property is the CLINICAL role: an approved clinical
 * standing held in addition to the organizational role, so a practice owner can
 * also be a treating doctor without the owner membership being downgraded.
 *
 * Effective permissions are the UNION of three explicit allowlists:
 *
 *     permissionsForRole("owner")                  // only when isOwner
 *   ∪ permissionsForRole(activeMembershipRole)
 *   ∪ clinicalPermissionsForRole(clinicalRole)     // only when ACTIVE
 *
 * There is no "owner may do everything" rule and no implicit grant: an owner
 * without an active membership gets exactly the owner allowlist, an `invited`
 * or `revoked` membership contributes nothing, and a clinical role that is
 * pending, rejected, revoked or unknown contributes nothing either. The
 * clinical role only ever adds CLINICAL_* permissions, never organizational
 * power.
 *
 * `role` is retained for backwards compatibility with existing call sites and
 * keeps its previous meaning ("owner" for the owner, otherwise the active
 * membership role). Prefer `effectivePermissions` / accessHasPermission().
 *
 * @param {string} userId
 * @param {string} practiceId
 * @returns {Promise<{
 *   practice: import('@prisma/client').PracticeProfile,
 *   practiceId: string,
 *   userId: string,
 *   isOwner: boolean,
 *   organizationalRole: string,
 *   clinicalRole: string | null,
 *   clinicalRoleStatus: string | null,
 *   membershipId: string | null,
 *   membershipStatus: string | null,
 *   membershipRole: string | null,
 *   effectivePermissions: Set<string>,
 *   role: string,
 * } | null>}
 */
export async function getPracticeAccess(userId, practiceId) {
  if (!userId || !practiceId) return null;
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
  });
  if (!practice) return null;

  const isOwner = practice.userId === userId;

  const member = await prisma.practiceMember.findUnique({
    where: {
      practiceProfileId_userId: { practiceProfileId: practiceId, userId },
    },
  });

  const membershipStatus = member?.status ?? null;
  const membershipRole = member?.role ?? null;
  // Only an ACTIVE membership contributes permissions.
  const activeMembershipRole = membershipStatus === "active" ? membershipRole : null;

  // No organizational ownership and no active membership -> no access at all.
  if (!isOwner && !activeMembershipRole) return null;

  // The clinical role is separate from the organizational one and only counts
  // when it is ACTIVE, i.e. approved by a different eligible person. pending,
  // rejected, revoked, null or unknown contribute nothing. It is additionally
  // ignored unless the membership itself is active, so a revoked member cannot
  // keep clinical rights through a stale approval.
  const clinicalRole = member?.clinicalRole ?? null;
  const clinicalRoleStatus = member?.clinicalRoleStatus ?? null;
  const clinicalRoleIsActive =
    clinicalRoleStatus === "active" && membershipStatus === "active";

  const organizationalRole = isOwner ? "owner" : activeMembershipRole;

  const effectivePermissions = new Set([
    ...(isOwner ? permissionsForRole("owner") : []),
    ...(activeMembershipRole ? permissionsForRole(activeMembershipRole) : []),
    // Clinical subset only — never organizational power.
    ...(clinicalRoleIsActive ? clinicalPermissionsForRole(clinicalRole) : []),
  ]);

  return {
    practice,
    practiceId,
    userId,
    isOwner,
    organizationalRole,
    clinicalRole,
    clinicalRoleStatus,
    membershipId: member?.id ?? null,
    membershipStatus,
    membershipRole,
    effectivePermissions,
    role: organizationalRole,
  };
}

/**
 * Permission check against an access object. Uses the precomputed effective
 * permissions (owner ∪ active membership) and falls back to the legacy single
 * role only if an older caller passes a bare `{ role }` object.
 *
 * @param {{ effectivePermissions?: Set<string>, role?: string } | null | undefined} access
 * @param {string} permission
 */
export function accessHasPermission(access, permission) {
  if (!access) return false;
  if (access.effectivePermissions instanceof Set) {
    return access.effectivePermissions.has(permission);
  }
  return hasPracticePermission(access.role, permission);
}

/**
 * @param {string} role
 * @param {string} permission
 */
export function requirePermission(role, permission) {
  if (!hasPracticePermission(role, permission)) {
    const err = new Error("forbidden");
    throw err;
  }
}
