/**
 * Owner-only practice lifecycle administration.
 *
 *   GET  /api/practices/:id/lifecycle                       status + open cases
 *   POST /api/practices/:id/lifecycle/suspend               active → suspended
 *   POST /api/practices/:id/lifecycle/reactivate            suspended → active
 *   POST /api/practices/:id/lifecycle/close                 active|suspended → closed
 *   POST /api/practices/:id/lifecycle/request-reactivation  closed → reactivation_requested
 *   POST /api/practices/:id/lifecycle/request-deletion      * → deletion_requested
 *
 * Security invariants:
 * - The practice id comes from the PATH only; a practice id in the body is an
 *   unsupported_field error, never a source of truth.
 * - Only the organizational owner (PracticeProfile.userId) may act. Admin,
 *   practice manager, doctor, assistant and secretary are rejected with
 *   practice_owner_required.
 * - Every mutation re-authenticates the owner with their password
 *   (confirmation_required otherwise) — a stolen bearer token alone cannot
 *   suspend, close or request deletion of a tenant.
 * - request-deletion NEVER deletes anything and NEVER touches
 *   ENABLE_DESTRUCTIVE_PRACTICE_DELETION. It records a written case, ends
 *   operative access, and leaves the irreversible step to the controlled
 *   MedScoutX process after review.
 * - Transition + case + audit row commit in ONE transaction; the status guard
 *   inside the transition makes concurrent requests lose cleanly (no lost
 *   updates, no duplicate cases).
 */
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { sendSafeJsonError, logServerError } from "../utils/safeApiError.js";
import { practiceLifecycleLimiter } from "../middleware/ipRateLimit.js";
import { writeAuditLog, writeRequiredAuditLog } from "../services/auditLogService.js";
import { getSupportEmail } from "../config/supportContact.js";
import {
  LIFECYCLE_ERRORS,
  LIFECYCLE_TRANSITIONS,
  applyPracticeLifecycleTransition,
  createLifecycleCase,
  findOpenLifecycleRequest,
  lifecycleTransitionErrorCode,
  practiceLifecycleStatusOf,
} from "../services/practiceLifecycle/practiceLifecycleService.js";
import {
  enqueueLifecycleReceiptPair,
  kickLifecycleOutbox,
} from "../services/practiceLifecycle/lifecycleOutboxService.js";
import { formatLifecycleTimestamp } from "../services/practiceLifecycle/lifecycleTime.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

class LifecycleHttpError extends Error {
  constructor(status, code) {
    super(code);
    this.httpStatus = status;
    this.lifecycleCode = code;
  }
}

/** Rejects bodies with fields outside the endpoint's allowlist. */
function assertOnlyFields(body, allowed) {
  if (body === undefined || body === null) return;
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new LifecycleHttpError(400, LIFECYCLE_ERRORS.UNSUPPORTED_FIELD);
  }
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      throw new LifecycleHttpError(400, LIFECYCLE_ERRORS.UNSUPPORTED_FIELD);
    }
  }
}

/**
 * Resolves owner access to the practice in the path (works for non-active
 * lifecycle states) and, for mutations, re-authenticates with the password.
 * Sends the error response itself and returns null when access is denied.
 */
async function resolveOwner(req, res, { reauth }) {
  const userId = userIdFromReq(req);
  if (!userId) {
    sendSafeJsonError(res, 401, "unauthorized", "Not authorized.");
    return null;
  }
  const access = await getPracticeAccess(userId, req.params.id, {
    allowInactiveLifecycle: true,
  });
  if (!access) {
    sendSafeJsonError(res, 404, "not_found", "Practice not found.");
    return null;
  }
  if (!access.isOwner) {
    writeAuditLog({
      req,
      userId,
      actorRole: access.role,
      action: "practice_lifecycle_denied_not_owner",
      entityType: "PracticeProfile",
      entityId: access.practiceId,
      practiceProfileId: access.practiceId,
      severity: "warning",
    });
    sendSafeJsonError(
      res, 403, LIFECYCLE_ERRORS.OWNER_REQUIRED,
      "Only the practice owner can perform lifecycle actions.",
    );
    return null;
  }
  if (reauth) {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password) {
      sendSafeJsonError(
        res, 401, LIFECYCLE_ERRORS.CONFIRMATION_REQUIRED,
        "Password confirmation is required.",
      );
      return null;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true },
    });
    const ok = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    if (!ok) {
      writeAuditLog({
        req,
        userId,
        actorRole: "owner",
        action: "practice_lifecycle_reauth_failed",
        entityType: "PracticeProfile",
        entityId: access.practiceId,
        practiceProfileId: access.practiceId,
        severity: "security",
      });
      sendSafeJsonError(
        res, 401, LIFECYCLE_ERRORS.CONFIRMATION_REQUIRED,
        "Password confirmation is required.",
      );
      return null;
    }
    access.ownerEmail = user.email;
  }
  return access;
}

function caseJson(row) {
  return {
    caseNumber: row.caseNumber,
    action: row.action,
    status: row.status,
    createdAt: row.createdAt,
  };
}

/**
 * GET /api/practices/:id/lifecycle
 * Status + open cases for the lifecycle section. Owner only.
 */
router.get("/:id/lifecycle", async (req, res) => {
  try {
    const access = await resolveOwner(req, res, { reauth: false });
    if (!access) return;

    const cases = await prisma.lifecycleCase.findMany({
      where: { practiceProfileId: access.practiceId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // The owner's own registered address — needed by the client to prefill
    // the confirmation e-mail draft. Never anyone else's data.
    const self = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { email: true },
    });

    return res.json({
      ok: true,
      status: practiceLifecycleStatusOf(access.practice),
      changedAt: access.practice.lifecycleStatusChangedAt ?? null,
      // The owner's own practice name. Needed because the settings API
      // (correctly) refuses a non-active practice, so the surrounding form
      // never loads it — without this the deletion-request mail would name no
      // practice at all.
      practiceName: access.practice.practiceName ?? null,
      supportEmail: getSupportEmail(),
      ownerEmail: self?.email ?? null,
      cases: cases.map(caseJson),
    });
  } catch (err) {
    logServerError("practice-lifecycle/get", err);
    return sendSafeJsonError(res, 500, "server_error", "Lifecycle status unavailable.");
  }
});

const CONFLICT_CODES = new Set([
  LIFECYCLE_ERRORS.TRANSITION_INVALID,
  LIFECYCLE_ERRORS.ALREADY_SUSPENDED,
  LIFECYCLE_ERRORS.ALREADY_CLOSED,
  LIFECYCLE_ERRORS.REACTIVATION_ALREADY_REQUESTED,
  LIFECYCLE_ERRORS.DELETION_ALREADY_REQUESTED,
]);

/**
 * Shared mutation flow: guarded transition + written case + mandatory audit
 * row, all in one transaction. `enrich` lets the deletion request add its
 * idempotency check without duplicating the transaction plumbing.
 */
async function runLifecycleMutation(req, res, {
  action,
  caseAction,
  caseStatus,
  allowedFields,
  auditSeverity = "warning",
  reason = null,
  preTransition = null,
}) {
  let access;
  try {
    assertOnlyFields(req.body, allowedFields);
    access = await resolveOwner(req, res, { reauth: true });
    if (!access) return;

    const lifecycleCase = await prisma.$transaction(async (tx) => {
      if (preTransition) await preTransition(tx, access);

      const applied = await applyPracticeLifecycleTransition(tx, {
        practiceId: access.practiceId,
        action,
      });
      if (!applied) {
        const fresh = await tx.practiceProfile.findUnique({
          where: { id: access.practiceId },
          select: { lifecycleStatus: true },
        });
        throw new LifecycleHttpError(
          409,
          lifecycleTransitionErrorCode(action, practiceLifecycleStatusOf(fresh)),
        );
      }

      const kase = await createLifecycleCase(tx, {
        action: caseAction,
        status: caseStatus,
        entityType: "practice_profile",
        practiceProfileId: access.practiceId,
        practiceName: access.practice.practiceName ?? null,
        requestedByUserId: access.userId,
        reason,
      });

      // Written receipt to the owner + internal MedScoutX notice, committed in
      // the SAME transaction as the state change (transactional outbox): a
      // rolled-back change sends nothing, a committed one cannot lose its
      // receipt, and the mail provider is never called inside the transaction.
      const profile = await tx.userProfile.findUnique({
        where: { userId: access.userId },
        select: { preferredUiLanguage: true },
      });
      const locale = profile?.preferredUiLanguage || "de";
      await enqueueLifecycleReceiptPair(tx, {
        caseNumber: kase.caseNumber,
        kind: caseAction,
        recipientEmail: access.ownerEmail,
        locale,
        params: {
          practiceName: access.practice.practiceName ?? "",
          actionAt: formatLifecycleTimestamp(new Date(), locale),
        },
        internalStatus: kase.status,
      });
      writeAuditLog({
        req,
        userId: access.userId,
        actorRole: "owner",
        action: "lifecycle_receipt_queued",
        entityType: "PracticeProfile",
        entityId: access.practiceId,
        practiceProfileId: access.practiceId,
        metadata: { caseNumber: kase.caseNumber },
      });

      await writeRequiredAuditLog(
        {
          req,
          userId: access.userId,
          actorRole: "owner",
          action: `lifecycle_${caseAction}`,
          entityType: "PracticeProfile",
          entityId: access.practiceId,
          practiceProfileId: access.practiceId,
          severity: auditSeverity,
          metadata: {
            caseNumber: kase.caseNumber,
            toStatus: LIFECYCLE_TRANSITIONS[action].to,
          },
        },
        tx,
      );

      return kase;
    });

    // Post-commit, outside any transaction: attempt delivery now; failures
    // stay queued and are retried by the lifecycleOutbox worker.
    kickLifecycleOutbox();

    return res.json({
      ok: true,
      status: LIFECYCLE_TRANSITIONS[action].to,
      caseNumber: lifecycleCase.caseNumber,
      caseStatus: lifecycleCase.status,
      supportEmail: getSupportEmail(),
      // Queued, NOT proven delivered.
      emailStatus: "email_delivery_pending",
    });
  } catch (err) {
    if (err instanceof LifecycleHttpError) {
      if (CONFLICT_CODES.has(err.lifecycleCode) && access) {
        writeAuditLog({
          req,
          userId: access.userId,
          actorRole: "owner",
          action: "practice_lifecycle_transition_rejected",
          entityType: "PracticeProfile",
          entityId: access.practiceId,
          practiceProfileId: access.practiceId,
          severity: "info",
          metadata: { attempted: action, code: err.lifecycleCode },
        });
      }
      return sendSafeJsonError(res, err.httpStatus, err.lifecycleCode, "Lifecycle action rejected.");
    }
    logServerError(`practice-lifecycle/${action}`, err);
    return sendSafeJsonError(res, 500, "server_error", "Lifecycle action failed.");
  }
}

/** POST /:id/lifecycle/suspend — active → suspended */
router.post("/:id/lifecycle/suspend", practiceLifecycleLimiter, (req, res) =>
  runLifecycleMutation(req, res, {
    action: "suspend",
    caseAction: "practice_suspended",
    caseStatus: "recorded",
    allowedFields: ["password"],
  }),
);

/** POST /:id/lifecycle/reactivate — suspended → active (owner self-service).
 * Deliberately restores NOTHING beyond the status: revoked consents, revoked
 * grants and removed team members stay exactly as they are. */
router.post("/:id/lifecycle/reactivate", practiceLifecycleLimiter, (req, res) =>
  runLifecycleMutation(req, res, {
    action: "reactivate",
    caseAction: "practice_reactivated",
    caseStatus: "recorded",
    allowedFields: ["password"],
  }),
);

/** POST /:id/lifecycle/close — active|suspended → closed */
router.post("/:id/lifecycle/close", practiceLifecycleLimiter, (req, res) =>
  runLifecycleMutation(req, res, {
    action: "close",
    caseAction: "practice_closed",
    caseStatus: "recorded",
    allowedFields: ["password"],
  }),
);

/** POST /:id/lifecycle/request-reactivation — closed → reactivation_requested */
router.post("/:id/lifecycle/request-reactivation", practiceLifecycleLimiter, (req, res) =>
  runLifecycleMutation(req, res, {
    action: "request_reactivation",
    caseAction: "practice_reactivation_requested",
    caseStatus: "in_review",
    allowedFields: ["password"],
  }),
);

/** POST /:id/lifecycle/request-deletion — records the written deletion
 * request. Does NOT delete, does NOT touch the release gate. */
router.post("/:id/lifecycle/request-deletion", practiceLifecycleLimiter, (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
  return runLifecycleMutation(req, res, {
    action: "request_deletion",
    caseAction: "practice_deletion_requested",
    caseStatus: "awaiting_email_confirmation",
    allowedFields: ["password", "reason"],
    auditSeverity: "security",
    reason,
    preTransition: async (tx, access) => {
      const open = await findOpenLifecycleRequest(
        tx,
        access.practiceId,
        "practice_deletion_requested",
      );
      if (open) {
        throw new LifecycleHttpError(409, LIFECYCLE_ERRORS.DELETION_ALREADY_REQUESTED);
      }
    },
  });
});

export default router;
