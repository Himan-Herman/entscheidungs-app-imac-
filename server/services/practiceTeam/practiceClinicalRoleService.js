/**
 * Clinical role assignment — held IN ADDITION to the organizational membership
 * role, so a practice owner can also be a treating doctor without the owner
 * membership ever being downgraded.
 *
 * INVARIANTS
 * ----------
 *  - Ownership never implies a clinical role. `PracticeProfile.userId` decides
 *    ownership and nothing else.
 *  - A request always starts as "pending". Only a DIFFERENT eligible active
 *    person may approve it — there is no self-approval and no self-activation.
 *  - TEAM_MANAGE does not imply CLINICAL_ROLE_MANAGE; approving a clinical
 *    standing is a separate decision from managing team membership.
 *  - `invited` / `revoked` / unknown memberships neither grant nor approve.
 *  - A foreign practice or a foreign membership is indistinguishable from a
 *    non-existent one: both yield `membership_not_found` (404), never 403.
 */

import { prisma } from "../../lib/prisma.js";
import { getPracticeAccess, accessHasPermission } from "../../utils/practiceAccess.js";
import {
  PERMISSIONS,
  ASSIGNABLE_CLINICAL_ROLES,
} from "../../utils/practicePermissions.js";
import { writeRequiredAuditLog } from "../auditLogService.js";

/** Statuses a request may move to, keyed by the status it comes from. */
const TRANSITIONS = {
  request: { from: [null, "rejected", "revoked"], to: "pending" },
  approve: { from: ["pending"], to: "active" },
  reject: { from: ["pending"], to: "rejected" },
  revoke: { from: ["active"], to: "revoked" },
};

function err(message) {
  return new Error(message);
}

/**
 * Loads a membership together with the actor's access to ITS practice.
 * Returns null when the membership does not exist or the actor has no access —
 * the caller must map both to 404 so foreign memberships cannot be probed.
 *
 * @param {string} actorUserId
 * @param {string} membershipId
 */
async function resolveMembership(actorUserId, membershipId) {
  const id = String(membershipId || "").trim();
  const actor = String(actorUserId || "").trim();
  if (!id || !actor) return null;

  const membership = await prisma.practiceMember.findUnique({
    where: { id },
    include: { practiceProfile: { select: { id: true, userId: true } } },
  });
  if (!membership) return null;

  const access = await getPracticeAccess(actor, membership.practiceProfileId);
  if (!access) return null;

  return { membership, access };
}

/**
 * Public shape of the clinical role for API responses. No medical content.
 * @param {object} row
 */
export function clinicalRoleJson(row) {
  return {
    clinicalRole: row.clinicalRole ?? null,
    clinicalRoleStatus: row.clinicalRoleStatus ?? null,
    clinicalRoleRequestedAt: row.clinicalRoleRequestedAt ?? null,
    clinicalRoleApprovedAt: row.clinicalRoleApprovedAt ?? null,
  };
}

/**
 * @param {{
 *   actorUserId: string,
 *   membershipId: string,
 *   action: "request" | "approve" | "reject" | "revoke",
 *   clinicalRole?: string,
 *   req?: import('express').Request,
 * }} input
 */
export async function changeClinicalRole(input) {
  const action = input?.action;
  const transition = TRANSITIONS[action];
  if (!transition) throw err("invalid_action");

  const resolved = await resolveMembership(input.actorUserId, input.membershipId);
  // Not found and no access are deliberately the same answer.
  if (!resolved) throw err("membership_not_found");

  const { membership, access } = resolved;
  const actorUserId = access.userId;
  const isSelf = membership.userId === actorUserId;

  // --- authorization -------------------------------------------------------
  if (action === "request") {
    // Anyone may ask for themselves; asking for someone else needs the right.
    if (!isSelf && !accessHasPermission(access, PERMISSIONS.CLINICAL_ROLE_MANAGE)) {
      throw err("forbidden");
    }
  } else if (action === "revoke") {
    // Reducing one's own privilege is always allowed; revoking someone else's
    // requires the management right.
    if (!isSelf && !accessHasPermission(access, PERMISSIONS.CLINICAL_ROLE_MANAGE)) {
      throw err("forbidden");
    }
  } else {
    // approve / reject
    if (!accessHasPermission(access, PERMISSIONS.CLINICAL_ROLE_MANAGE)) {
      throw err("forbidden");
    }
    // The decisive rule: nobody approves or rejects their own clinical role,
    // regardless of how much organizational power they hold.
    if (isSelf) throw err("self_approval_forbidden");
  }

  // The target must be an active member; an invited or revoked membership
  // must not acquire or hold a clinical standing.
  if (membership.status !== "active") throw err("membership_not_active");

  // --- state machine -------------------------------------------------------
  const current = membership.clinicalRoleStatus ?? null;
  if (!transition.from.includes(current)) throw err("invalid_status_transition");

  let clinicalRole = membership.clinicalRole ?? null;
  if (action === "request") {
    clinicalRole = String(input.clinicalRole || "doctor").trim();
    if (!ASSIGNABLE_CLINICAL_ROLES.includes(clinicalRole)) {
      throw err("invalid_clinical_role");
    }
  }

  const now = new Date();
  const data = { clinicalRole, clinicalRoleStatus: transition.to };
  if (action === "request") {
    data.clinicalRoleRequestedAt = now;
    data.clinicalRoleApprovedAt = null;
    data.clinicalRoleApprovedByUserId = null;
  } else if (action === "approve") {
    data.clinicalRoleApprovedAt = now;
    data.clinicalRoleApprovedByUserId = actorUserId;
  } else {
    // reject / revoke clear the approval marker but keep the requested role
    // so the history stays readable.
    data.clinicalRoleApprovedAt = null;
    data.clinicalRoleApprovedByUserId = null;
  }

  // Conditional update: the status we validated must still be the stored one.
  // Two concurrent approvals therefore produce exactly one state change; the
  // loser sees `count === 0` and is rejected instead of silently overwriting.
  const result = await prisma.practiceMember.updateMany({
    where: { id: membership.id, clinicalRoleStatus: current },
    data,
  });
  if (result.count !== 1) throw err("concurrent_modification");

  const updated = await prisma.practiceMember.findUnique({
    where: { id: membership.id },
  });

  // Mandatory audit: a clinical standing must never change unrecorded.
  await writeRequiredAuditLog({
    req: input.req,
    userId: actorUserId,
    actorRole: access.organizationalRole,
    action: `practice_clinical_role_${action}`,
    entityType: "practice_membership",
    entityId: membership.id,
    practiceProfileId: membership.practiceProfileId,
    metadata: {
      targetUserId: membership.userId,
      clinicalRole,
      previousStatus: current,
      newStatus: transition.to,
    },
  });

  return clinicalRoleJson(updated);
}

/**
 * Whether the given access may act on the target's clinical role. Used by the
 * API so the UI never renders a self-approval control.
 *
 * @param {{ effectivePermissions?: Set<string>, userId?: string }} access
 * @param {{ userId: string }} membership
 */
export function clinicalRoleCapabilities(access, membership) {
  const isSelf = membership.userId === access?.userId;
  const canManage = accessHasPermission(access, PERMISSIONS.CLINICAL_ROLE_MANAGE);
  return {
    canRequest: isSelf || canManage,
    canApprove: canManage && !isSelf,
    canReject: canManage && !isSelf,
    canRevoke: isSelf || canManage,
  };
}
