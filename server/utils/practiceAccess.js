import { prisma } from "../lib/prisma.js";
import {
  hasPracticePermission,
  permissionsForRole,
  clinicalPermissionsForRole,
} from "./practicePermissions.js";
import { practiceLifecycleStatusOf } from "../services/practiceLifecycle/practiceLifecycleService.js";


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
 * MEMBERSHIP LIFECYCLE
 * --------------------
 * A practice whose lifecycleStatus is not "active" (suspended, closed,
 * reactivation_requested, deletion_requested) has NO operative access for
 * anyone — owner and members alike get `null`, which every practice route
 * already treats as not-found. Because auth tokens are stateless JWTs there is
 * no session store to revoke, so this per-request check IS the revocation:
 * patient reads and writes, new links, documents, grants, medication plans,
 * team work, clinical functions and the active practice switcher all stop.
 *
 * The single exception is `opts.allowInactiveLifecycle`, reserved for the
 * dedicated owner-facing lifecycle routes (read status, lift a suspension,
 * request reactivation, view a deletion request, necessary exports/support).
 * Even then ONLY the owner passes — never a team member — and the option is
 * never used on clinical, patient, document or team-administration routes.
 *
 * It is likewise NOT used for the destructive deletion path: that path
 * authorizes through resolvePracticeOwnerForControlledDeletion() below and
 * hands a validated id to deletePracticeWithArchivedContext(), which never
 * re-resolves operative access.
 *
 * This is orthogonal to the ARCHIVE lifecycle: a closed practice still exists
 * and is merely non-operative, whereas an ArchivedPracticePatientContext is
 * the snapshot of a practice that was physically deleted.
 *
 * @param {string} userId
 * @param {string} practiceId
 * @param {{ allowInactiveLifecycle?: boolean }} [opts]
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
export async function getPracticeAccess(userId, practiceId, opts = {}) {
  if (!userId || !practiceId) return null;
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
  });
  if (!practice) return null;

  const isOwner = practice.userId === userId;

  const lifecycleStatus = practiceLifecycleStatusOf(practice);
  if (lifecycleStatus !== "active" && (!opts.allowInactiveLifecycle || !isOwner)) {
    return null;
  }

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
    lifecycleStatus,
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
 * Ownership resolution for the CONTROLLED destructive deletion path only.
 *
 * The membership lifecycle must not be able to strand a practice: once an
 * owner has requested deletion the practice sits in `deletion_requested`, and
 * the reviewed MedScoutX deletion run still has to reach it. Routing that
 * through getPracticeAccess({ allowInactiveLifecycle: true }) would mean
 * handing the lenient flag to the one path that must never receive it, so the
 * destructive route resolves ownership here instead — independently of the
 * membership lifecycle and WITHOUT computing any operative permissions.
 *
 * It returns exactly the three outcomes the existing delete route already
 * distinguishes, so its 404/403 behaviour is unchanged:
 *   null                  -> practice unknown, or caller unrelated to it (404)
 *   { isOwner: false }    -> caller is an active member but not the owner (403)
 *   { isOwner: true }     -> organizational owner (proceed to gate + phrase)
 *
 * The release gate, the confirmation phrase and every archive/lock invariant
 * inside deletePracticeWithArchivedContext stay in force; this function is
 * authorization input, never authorization by itself.
 *
 * @param {string} userId
 * @param {string} practiceId
 * @returns {Promise<{ practice: import('@prisma/client').PracticeProfile, isOwner: boolean } | null>}
 */
export async function resolvePracticeOwnerForControlledDeletion(userId, practiceId) {
  if (!userId || !practiceId) return null;
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
  });
  if (!practice) return null;
  if (practice.userId === userId) return { practice, isOwner: true };

  // Not the owner: only an ACTIVE member may learn that the practice exists,
  // everyone else gets the same not-found answer as before.
  const member = await prisma.practiceMember.findUnique({
    where: { practiceProfileId_userId: { practiceProfileId: practiceId, userId } },
  });
  if (member?.status === "active") return { practice, isOwner: false };
  return null;
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
