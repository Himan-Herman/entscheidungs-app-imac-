import { prisma } from "../lib/prisma.js";
import { hasPracticePermission, permissionsForRole } from "./practicePermissions.js";


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
 * The two are independent, so a practice owner who also treats patients can
 * hold both. Effective permissions are the UNION of two explicit allowlists:
 *
 *     permissionsForRole("owner")            // only when isOwner
 *   ∪ permissionsForRole(activeMembershipRole)
 *
 * There is no "owner may do everything" rule and no implicit grant: an owner
 * without an active membership gets exactly the owner allowlist, and an
 * `invited` or `revoked` membership contributes nothing.
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

  const effectivePermissions = new Set([
    ...(isOwner ? permissionsForRole("owner") : []),
    ...(activeMembershipRole ? permissionsForRole(activeMembershipRole) : []),
  ]);

  return {
    practice,
    practiceId,
    userId,
    isOwner,
    membershipId: member?.id ?? null,
    membershipStatus,
    membershipRole,
    effectivePermissions,
    role: isOwner ? "owner" : activeMembershipRole,
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
