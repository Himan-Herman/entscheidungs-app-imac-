/**
 * Practice tenant lifecycle: a small, closed state machine.
 *
 *   active ⇄ suspended            (owner self-service, both directions)
 *   active | suspended → closed   (owner self-service)
 *   closed → reactivation_requested            (owner asks MedScoutX)
 *   reactivation_requested → active            (MedScoutX approval only — no route)
 *   active | suspended | closed → deletion_requested  (owner asks MedScoutX)
 *
 * There are NO other transitions. deletion_requested has no self-service exit:
 * leaving it requires the controlled withdrawal of the deletion request by
 * MedScoutX. "deleted" is not a status — the destructive deletion of the row
 * itself stays behind ENABLE_DESTRUCTIVE_PRACTICE_DELETION (default off) and a
 * completed MedScoutX review; a deletion request never deletes anything.
 *
 * Every transition is applied with a status-guarded updateMany so two
 * concurrent requests cannot both win: exactly one sees count === 1, the other
 * gets a stable conflict error and no state is lost.
 */
import crypto from "crypto";

export const PRACTICE_LIFECYCLE_STATUSES = Object.freeze([
  "active",
  "suspended",
  "closed",
  "reactivation_requested",
  "deletion_requested",
]);

export const LIFECYCLE_ERRORS = Object.freeze({
  TRANSITION_INVALID: "practice_lifecycle_transition_invalid",
  OWNER_REQUIRED: "practice_owner_required",
  ALREADY_SUSPENDED: "practice_already_suspended",
  ALREADY_CLOSED: "practice_already_closed",
  REACTIVATION_ALREADY_REQUESTED: "reactivation_already_requested",
  DELETION_ALREADY_REQUESTED: "deletion_already_requested",
  CONFIRMATION_REQUIRED: "confirmation_required",
  UNSUPPORTED_FIELD: "unsupported_field",
});

/** Owner-triggerable lifecycle actions. approve_reactivation is deliberately absent. */
export const LIFECYCLE_TRANSITIONS = Object.freeze({
  suspend: Object.freeze({ from: Object.freeze(["active"]), to: "suspended" }),
  reactivate: Object.freeze({ from: Object.freeze(["suspended"]), to: "active" }),
  close: Object.freeze({ from: Object.freeze(["active", "suspended"]), to: "closed" }),
  request_reactivation: Object.freeze({
    from: Object.freeze(["closed"]),
    to: "reactivation_requested",
  }),
  request_deletion: Object.freeze({
    from: Object.freeze(["active", "suspended", "closed"]),
    to: "deletion_requested",
  }),
});

/**
 * Rows written before the lifecycle migration have no status column value in
 * old snapshots; treat anything unknown as "active" for reads (never writes).
 * @param {{ lifecycleStatus?: string | null } | null | undefined} practice
 */
export function practiceLifecycleStatusOf(practice) {
  const s = practice?.lifecycleStatus;
  return PRACTICE_LIFECYCLE_STATUSES.includes(s) ? s : "active";
}

/**
 * Operative = normal day-to-day practice work is allowed. Everything that is
 * not "active" blocks operative reads and writes, new patient connections,
 * shares, plans, and public entry points.
 */
export function isPracticeOperative(practice) {
  return practiceLifecycleStatusOf(practice) === "active";
}

/**
 * Maps a failed transition to the most specific stable error code. Never
 * returns internal detail; the codes are part of the public API contract.
 * @param {string} action key of LIFECYCLE_TRANSITIONS
 * @param {string} currentStatus
 */
export function lifecycleTransitionErrorCode(action, currentStatus) {
  if (action === "suspend" && currentStatus === "suspended") {
    return LIFECYCLE_ERRORS.ALREADY_SUSPENDED;
  }
  if (action === "close" && currentStatus === "closed") {
    return LIFECYCLE_ERRORS.ALREADY_CLOSED;
  }
  if (action === "request_reactivation" && currentStatus === "reactivation_requested") {
    return LIFECYCLE_ERRORS.REACTIVATION_ALREADY_REQUESTED;
  }
  if (currentStatus === "deletion_requested") {
    return LIFECYCLE_ERRORS.DELETION_ALREADY_REQUESTED;
  }
  return LIFECYCLE_ERRORS.TRANSITION_INVALID;
}

/**
 * Atomically applies one lifecycle transition. The from-status guard in the
 * WHERE clause is the concurrency control: of two parallel requests exactly
 * one matches, the other returns false and must map the conflict via
 * lifecycleTransitionErrorCode().
 *
 * @param {import('@prisma/client').Prisma.TransactionClient | import('@prisma/client').PrismaClient} db
 * @param {{ practiceId: string, action: keyof typeof LIFECYCLE_TRANSITIONS }} args
 * @returns {Promise<boolean>} true iff the transition was applied
 */
export async function applyPracticeLifecycleTransition(db, { practiceId, action }) {
  const t = LIFECYCLE_TRANSITIONS[action];
  if (!t) return false;
  const result = await db.practiceProfile.updateMany({
    where: { id: practiceId, lifecycleStatus: { in: [...t.from] } },
    data: { lifecycleStatus: t.to, lifecycleStatusChangedAt: new Date() },
  });
  return result.count === 1;
}

/** action → case-number prefix. The deletion request uses the documented "PD". */
const CASE_NUMBER_PREFIX = Object.freeze({
  practice_suspended: "PS",
  practice_reactivated: "PA",
  practice_closed: "PC",
  practice_reactivation_requested: "PR",
  practice_deletion_requested: "PD",
  account_deleted: "AD",
});

const MAX_REASON_LENGTH = 500;

/**
 * Creates the written, data-minimal lifecycle case row and assigns its
 * human-readable case number ("PD-2026-000123") from the DB sequence. Runs in
 * two steps inside the caller's transaction because the sequence value only
 * exists after the insert; the temporary placeholder is never visible outside
 * the transaction.
 *
 * Stores NO medical content — reason is a truncated, owner-provided free text
 * that the UI labels as strictly non-medical.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{
 *   action: string,
 *   entityType: "practice_profile" | "user_account",
 *   status?: string,
 *   practiceProfileId?: string | null,
 *   practiceName?: string | null,
 *   requestedByUserId?: string | null,
 *   reason?: string | null,
 * }} args
 */
export async function createLifecycleCase(tx, args) {
  const reason =
    typeof args.reason === "string" && args.reason.trim()
      ? args.reason.trim().slice(0, MAX_REASON_LENGTH)
      : null;

  const created = await tx.lifecycleCase.create({
    data: {
      caseNumber: `TMP-${crypto.randomUUID()}`,
      action: args.action,
      status: args.status || "recorded",
      entityType: args.entityType,
      practiceProfileId: args.practiceProfileId ?? null,
      practiceName: args.practiceName ?? null,
      requestedByUserId: args.requestedByUserId ?? null,
      reason,
    },
  });

  const prefix = CASE_NUMBER_PREFIX[args.action] || "LC";
  const year = new Date(created.createdAt ?? Date.now()).getFullYear();
  const caseNumber = `${prefix}-${year}-${String(created.seq).padStart(6, "0")}`;

  return tx.lifecycleCase.update({
    where: { id: created.id },
    data: { caseNumber },
  });
}

/**
 * Open (i.e. not completed/withdrawn) request cases for a practice — used to
 * make repeat requests idempotent instead of stacking duplicate active cases.
 * @param {import('@prisma/client').Prisma.TransactionClient | import('@prisma/client').PrismaClient} db
 */
export async function findOpenLifecycleRequest(db, practiceProfileId, action) {
  return db.lifecycleCase.findFirst({
    where: {
      practiceProfileId,
      action,
      status: { in: ["recorded", "awaiting_email_confirmation", "in_review"] },
    },
    orderBy: { createdAt: "desc" },
  });
}
