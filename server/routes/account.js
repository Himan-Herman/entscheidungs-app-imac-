/**
 * GDPR-style account data export and targeted Pre-Visit / practice data deletion.
 *
 * Deletion levels (product surface area):
 * 1) Single Pre-Visit session — DELETE /api/previsit/sessions/:id
 * 2) Longitudinal case / timeline — use previsit cases API (user-scoped)
 * 3) Doctor contact — DELETE /api/user/doctor-contacts/:id
 * 4) Practice profile (owner) — DELETE /api/practices/:id
 * 5) All user-owned Pre-Visit-related data (this file) — DELETE /api/account/delete
 * 6) Full account erasure (GDPR Art. 17) — DELETE /api/account/delete also removes the login
 *    User row, which DB-level ON DELETE CASCADE propagates to all patient-owned data.
 *
 * The deletion transaction removes the User row; cascades erase patient-owned health data,
 * while practice-side actor references are SET NULL per the schema design.
 */
import express from "express";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { sendSafeJsonError, logServerError } from "../utils/safeApiError.js";
import {
  accountDeleteLimiter,
  accountExportLimiter,
} from "../middleware/ipRateLimit.js";
import { getBillingPlausibilityExportForUser } from "../services/billingPlausibility/billingPlausibilityService.js";
import {
  CONTEXTUAL_DATA_BLOCKED,
  blockerAuditMetadata,
  checkUserDeletionBlockers,
} from "../services/dataLifecycle/contextualPatientDataDeletionGuard.js";
import {
  ARCHIVE_CONFLICT,
  ARCHIVE_INCOMPLETE,
  ARCHIVE_REASONS,
  deleteOwnPatientDataForUser,
  deletePracticeWithArchivedContext,
  releaseDocumentShareGrantsForPatient,
} from "../services/dataLifecycle/archivePracticePatientContext.js";
import {
  isDestructivePracticeDeletionEnabled,
  OWNER_ACCOUNT_DELETION_UNAVAILABLE,
} from "../services/startup/destructiveDeletionGate.js";

const router = express.Router();

const DELETE_CONFIRM = "DELETE_MY_MEDSCOUTX_DATA";

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function targetJsonExport(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    targetName: row.targetName,
    targetType: row.targetType,
    doctorName: row.doctorName,
    specialty: row.specialty,
    recipientEmail: row.recipientEmail,
    preferredDoctorLanguage: row.preferredDoctorLanguage,
    isActive: row.isActive,
  };
}

function sessionExportJson(row) {
  return {
    id: row.id,
    preVisitCaseId: row.preVisitCaseId,
    practiceProfileId: row.practiceProfileId,
    practiceQrTargetId: row.practiceQrTargetId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    patientLanguage: row.patientLanguage,
    doctorLanguage: row.doctorLanguage,
    title: row.title,
    status: row.status,
    practiceStatus: row.practiceStatus,
    pdfDownloaded: row.pdfDownloaded,
    answers: row.answers,
    aiDoctorVersion: row.aiDoctorVersion,
    aiSafetyNotice: row.aiSafetyNotice,
  };
}

/**
 * GET /api/account/export
 */
router.get("/export", accountExportLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) {
    return sendSafeJsonError(res, 401, "unauthorized", "Not authorized.");
  }

  writeAuditLog({
    req,
    userId,
    action: "account_data_export_requested",
    metadata: {},
  });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        consent: true,
        doctorContacts: { orderBy: { updatedAt: "desc" } },
        doctors: true,
        preVisitCases: { orderBy: { updatedAt: "desc" } },
        preVisitSessions: { orderBy: { createdAt: "desc" } },
        practiceMemberships: { orderBy: { createdAt: "asc" } },
        practiceProfiles: {
          orderBy: { updatedAt: "desc" },
          include: { qrTargets: { orderBy: { updatedAt: "desc" } } },
        },
        auditLogs: { orderBy: { createdAt: "desc" }, take: 500 },
      },
    });

    if (!user) {
      return sendSafeJsonError(res, 404, "not_found", "User not found.");
    }

    const patientThreads = await prisma.preVisitFollowUpThread.findMany({
      where: { patientUserId: userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        session: {
          select: { id: true, createdAt: true, title: true, patientLanguage: true },
        },
        practiceProfile: { select: { id: true, practiceName: true } },
        qrTarget: { select: { id: true, targetName: true, doctorName: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    const redactThreads = patientThreads.map((t) => ({
      id: t.id,
      preVisitSessionId: t.preVisitSessionId,
      practiceProfileId: t.practiceProfileId,
      qrTargetId: t.qrTargetId,
      status: t.status,
      title: t.title,
      isArchived: t.isArchived,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      session: t.session,
      practice: t.practiceProfile,
      target: t.qrTarget,
      messages: t.messages,
    }));

    const interpreterCloudSessionCount =
      await prisma.interpreterCloudSession.count({
        where: { userId },
      });
    const interpreterCloudPreference =
      await prisma.interpreterCloudPreference.findUnique({
        where: { userId },
        select: {
          cloudEnabled: true,
          consentGrantedAt: true,
          consentRevokedAt: true,
          consentVersion: true,
        },
      });
    const interpreterCloudConsentEvents = await prisma.consentRecord.findMany({
      where: {
        patientUserId: userId,
        consentType: "interpreter_cloud_storage",
        practicePatientLinkId: null,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        grantedAt: true,
        revokedAt: true,
        version: true,
        createdAt: true,
      },
    });

    const auditForExport = (user.auditLogs || []).map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      actorRole: a.actorRole,
      createdAt: a.createdAt,
      metadata: a.metadata,
    }));

    // Phase D3 — billing plausibility data portability (GDPR Art. 15/20).
    // Privacy-safe whitelist serialization; raw contextText and raw AI
    // prompts/responses are never included (see service helper docblock).
    const billingPlausibilitySessions =
      await getBillingPlausibilityExportForUser(userId);

    const practiceProfilesExport = (user.practiceProfiles || []).map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      practiceName: p.practiceName,
      publicSlug: p.publicSlug,
      logoUrl: p.logoUrl,
      address: p.address,
      phone: p.phone,
      email: p.email,
      website: p.website,
      specialty: p.specialty,
      preferredDoctorLanguage: p.preferredDoctorLanguage,
      patientIntroText: p.patientIntroText,
      isActive: p.isActive,
      qrTargets: (p.qrTargets || []).map((t) => targetJsonExport(t)),
    }));

    const userExport = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth?.toISOString?.() ?? user.dateOfBirth,
      verified: user.verified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile,
      consent: user.consent,
      doctorContacts: user.doctorContacts,
      doctors: user.doctors,
      practiceMemberships: user.practiceMemberships,
      practiceProfiles: practiceProfilesExport,
      preVisitSessions: (user.preVisitSessions || []).map(sessionExportJson),
      preVisitCases: user.preVisitCases,
      followUpThreadsPatient: redactThreads,
      auditLog: auditForExport,
      billingPlausibilitySessions,
      medicalInterpreterCloud: {
        sessionCount: interpreterCloudSessionCount,
        preference: interpreterCloudPreference
          ? {
              cloudEnabled: interpreterCloudPreference.cloudEnabled,
              consentVersion: interpreterCloudPreference.consentVersion,
              consentGrantedAt:
                interpreterCloudPreference.consentGrantedAt?.toISOString?.() ??
                null,
              consentRevokedAt:
                interpreterCloudPreference.consentRevokedAt?.toISOString?.() ??
                null,
            }
          : null,
        consentEvents: interpreterCloudConsentEvents.map((r) => ({
          id: r.id,
          status: r.status,
          grantedAt: r.grantedAt?.toISOString?.() ?? r.grantedAt,
          revokedAt: r.revokedAt?.toISOString?.() ?? r.revokedAt,
          version: r.version,
          createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
        })),
        note:
          "Conversation text is stored encrypted on the server only when you explicitly save to your account. Audio is never stored. Full text is available via interpreter cloud session export APIs when signed in.",
      },
    };

    return res.json({
      ok: true,
      exportedAt: new Date().toISOString(),
      version: 1,
      user: userExport,
    });
  } catch (err) {
    logServerError("account/export", err);
    return sendSafeJsonError(res, 500, "server_error", "Export could not be completed.");
  }
});

/**
 * DELETE /api/account/delete
 * Body: { "confirmation": "DELETE_MY_MEDSCOUTX_DATA" }
 */
router.delete("/delete", accountDeleteLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) {
    return sendSafeJsonError(res, 401, "unauthorized", "Not authorized.");
  }

  const confirmation = String(req.body?.confirmation ?? "").trim();
  if (confirmation !== DELETE_CONFIRM) {
    return sendSafeJsonError(res, 400, "confirmation_required", "Confirmation phrase does not match.");
  }

  // Erasing an account that OWNS a practice also deletes that practice — and
  // with it, today, its documents. That path is gated until the retention
  // question is answered; a plain patient's erasure is unaffected. Checked
  // again inside the transaction, so ownership gained in between cannot slip
  // past this early answer.
  if (!isDestructivePracticeDeletionEnabled()) {
    const ownedCount = await prisma.practiceProfile.count({ where: { userId } });
    if (ownedCount > 0) {
      return sendSafeJsonError(
        res, 409, OWNER_ACCOUNT_DELETION_UNAVAILABLE,
        "Account deletion is temporarily unavailable for practice owners.",
      );
    }
  }

  writeAuditLog({
    req,
    userId,
    action: "account_data_delete_requested",
    metadata: { scope: "previsit_and_related" },
  });

  try {
    // Aggregates for the audit trail. Counts only — never an id, a name or a
    // medical value.
    const lifecycle = {
      practicesDeleted: 0,
      foreignLinksArchived: 0,
      foreignRecordsArchived: {},
      ownRecordsRemoved: {},
      ownRecordsRemovedTotal: 0,
      ownArchivesRemoved: 0,
      grantsRevoked: 0,
      tokensRevoked: 0,
    };

    await prisma.$transaction(async (tx) => {
      // Lock the account first. Every path below — practice deletion and the
      // user's own data — takes its locks in the same order (user, practice,
      // links by id), so account and practice erasure cannot deadlock.
      const userRows = await tx.$queryRaw`
        SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
      `;
      if (userRows.length === 0) throw new Error("account_not_found");

      // 1. OTHER PATIENTS FIRST. Contextual records recorded at a practice this
      //    user owns belong to those patients, not to this account. They are
      //    archived — never deleted, never re-labelled — before the practice
      //    that anchors them disappears. Deterministic order by id.
      const owned = await tx.practiceProfile.findMany({
        where: { userId },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      // The authoritative gate check, under the user lock: ownership that
      // appeared after the early check still stops the erasure, atomically.
      if (owned.length > 0 && !isDestructivePracticeDeletionEnabled()) {
        throw new Error(OWNER_ACCOUNT_DELETION_UNAVAILABLE);
      }
      for (const practice of owned) {
        const result = await deletePracticeWithArchivedContext({
          transaction: tx,
          practiceProfileId: practice.id,
          deletionReason: ARCHIVE_REASONS.OWNER_ACCOUNT_DELETED,
          deletingUserId: userId,
        });
        lifecycle.practicesDeleted += 1;
        lifecycle.foreignLinksArchived += result.archived.archivedLinks;
        for (const [model, n] of Object.entries(result.archived.movedByModel)) {
          lifecycle.foreignRecordsArchived[model] =
            (lifecycle.foreignRecordsArchived[model] ?? 0) + n;
        }
        lifecycle.grantsRevoked += result.grants.grantsRevoked;
        lifecycle.tokensRevoked += result.grants.tokensRevoked;
      }

      // 2. The user's OWN share grants — as the patient and as the granting
      //    user. Grants of other people that merely involve a practice this
      //    user never owned are not touched.
      const ownGrants = await releaseDocumentShareGrantsForPatient({
        transaction: tx, patientUserId: userId,
      });
      lifecycle.grantsRevoked += ownGrants.grantsRevoked;
      lifecycle.tokensRevoked += ownGrants.tokensRevoked;

      // 3. The user's OWN medical records, in every scope and state, then the
      //    archive contexts that nothing points at any more. This is the
      //    patient's own data and the erasure decision applies to it; archiving
      //    it first only to delete it a moment later would be pointless work on
      //    medical data.
      const own = await deleteOwnPatientDataForUser({
        transaction: tx, patientUserId: userId,
      });
      lifecycle.ownRecordsRemoved = own.removedByModel;
      lifecycle.ownRecordsRemovedTotal = own.removedTotal;
      lifecycle.ownArchivesRemoved = own.archivesRemoved;

      await tx.preVisitSession.deleteMany({ where: { userId } });
      await tx.preVisitCase.deleteMany({ where: { userId } });
      await tx.doctorContact.deleteMany({ where: { userId } });
      await tx.doctor.deleteMany({ where: { userId } });
      await tx.auditLog.deleteMany({ where: { userId } });

      // ── Billing plausibility cleanup (Phase D2 — GDPR Art. 17 erasure) ──────
      // BillingPlausibilitySession.practiceProfileId and .createdByUserId are
      // SCALAR foreign keys (no Prisma @relation to User/PracticeProfile), so
      // there is NO database-level cascade when the user or their practice
      // profiles are deleted below. Without this explicit step, billing
      // sessions (which may contain contextText, resultSummaryJson and staff
      // user IDs) would be orphaned after account deletion.
      //
      // Sessions in scope = those created by this user OR owned by any practice
      // profile this user owns. We resolve the practice IDs BEFORE deleting the
      // practice profiles further down, so ordering matters.
      //
      // Item and AuditLog rows DO cascade from their session
      // (onDelete: Cascade), but we delete them explicitly in dependency order
      // for defense-in-depth and to keep the erasure intent self-evident.
      const ownedPractices = await tx.practiceProfile.findMany({
        where: { userId },
        select: { id: true },
      });
      const ownedPracticeIds = ownedPractices.map((p) => p.id);

      const billingSessions = await tx.billingPlausibilitySession.findMany({
        where: {
          OR: [
            { createdByUserId: userId },
            ...(ownedPracticeIds.length
              ? [{ practiceProfileId: { in: ownedPracticeIds } }]
              : []),
          ],
        },
        select: { id: true },
      });
      const billingSessionIds = billingSessions.map((s) => s.id);

      if (billingSessionIds.length > 0) {
        await tx.billingPlausibilityAuditLog.deleteMany({
          where: { sessionId: { in: billingSessionIds } },
        });
        await tx.billingPlausibilityItem.deleteMany({
          where: { sessionId: { in: billingSessionIds } },
        });
        await tx.billingPlausibilitySession.deleteMany({
          where: { id: { in: billingSessionIds } },
        });
      }

      // The owned practices were deleted above, through the shared service.
      await tx.practiceMember.deleteMany({ where: { userId } });
      await tx.interpreterCloudSession.deleteMany({ where: { userId } });
      await tx.interpreterCloudPreference.deleteMany({ where: { userId } });

      // ── Full erasure (GDPR Art. 17) ───────────────────────────────────────
      // The only onDelete: Restrict FK to User (PracticeInterpreterInvite.createdBy)
      // would block the user-row delete; remove those invites first — their usage
      // rows cascade from the invite.
      await tx.practiceInterpreterInvite.deleteMany({ where: { createdByUserId: userId } });

      // Scalar *UserId columns with NO @relation get no DB-level cascade, so the
      // patient's rows must be removed explicitly or they would be orphaned.
      await tx.externalResourceReference.deleteMany({ where: { patientUserId: userId } });
      await tx.practiceMedaSession.deleteMany({
        where: { OR: [{ patientUserId: userId }, { createdByUserId: userId }] },
      });

      // Practice-authored audit rows ABOUT this patient (authored by a different
      // user, so they do not cascade) — drop the dangling patient identifier.
      // Audit rows store no health data; this only removes the reference.
      await tx.auditLog.updateMany({
        where: { patientUserId: userId },
        data: { patientUserId: null },
      });
      await tx.practiceDocumentAuditEntry.updateMany({
        where: { patientUserId: userId },
        data: { patientUserId: null },
      });

      // Postconditions before the point of no return. The guard stays — it now
      // confirms the erasure is complete rather than refusing it up front.
      const blockers = await checkUserDeletionBlockers(userId, tx);
      if (blockers.blocked) {
        const err = new Error(CONTEXTUAL_DATA_BLOCKED);
        err.blockerReport = blockers;
        throw err;
      }
      const ownPracticesLeft = await tx.practiceProfile.count({ where: { userId } });
      if (ownPracticesLeft > 0) {
        throw new Error("account_deletion_incomplete");
      }

      // Finally remove the login user row. DB-level ON DELETE CASCADE then erases all
      // patient-owned data (profile, SOS card, symptoms, allergies, diagnoses, vitals,
      // vaccinations, medication plans, e-prescriptions, pre-visit sessions/cases,
      // consent records, patient documents/shares, data requests, export jobs, …).
      await tx.user.delete({ where: { id: userId } });
    });

    // Accountability trace that survives the erasure. Aggregates only: no user
    // or patient identifier, no practice name, no medical value — the numbers
    // are what makes the erasure auditable without recording what was erased.
    if (lifecycle.foreignLinksArchived > 0) {
      writeAuditLog({
        req,
        action: "account_deletion_context_archived",
        metadata: {
          archiveReason: ARCHIVE_REASONS.OWNER_ACCOUNT_DELETED,
          archivedLinks: lifecycle.foreignLinksArchived,
          archivedByModel: lifecycle.foreignRecordsArchived,
        },
      });
    }
    if (lifecycle.grantsRevoked > 0 || lifecycle.tokensRevoked > 0) {
      writeAuditLog({
        req,
        action: "document_share_grants_revoked_for_account_deletion",
        metadata: {
          grantsRevoked: lifecycle.grantsRevoked,
          tokensRevoked: lifecycle.tokensRevoked,
        },
      });
    }
    writeAuditLog({
      req,
      action: "account_deletion_patient_data_removed",
      metadata: {
        removedByModel: lifecycle.ownRecordsRemoved,
        removedTotal: lifecycle.ownRecordsRemovedTotal,
        archiveContextsRemoved: lifecycle.ownArchivesRemoved,
      },
    });
    if (lifecycle.practicesDeleted > 0) {
      writeAuditLog({
        req,
        action: "account_deletion_practices_removed",
        metadata: { practicesDeleted: lifecycle.practicesDeleted },
      });
    }
    writeAuditLog({
      req,
      action: "account_deletion_completed",
      metadata: { scope: "full_account_erasure" },
    });

    // No counts and no identifiers leave the server.
    return res.json({ ok: true, deleted: true, scope: "full_account_erasure" });
  } catch (err) {
    // Blocked by contextual medical records: the transaction rolled back, the
    // account is untouched. Report a stable code and nothing else — no counts,
    // no link ids, no categories reach the client.
    if (err?.message === CONTEXTUAL_DATA_BLOCKED) {
      // Now a postcondition failure rather than an upfront refusal: something
      // the archiving did not cover still references this account. The
      // transaction rolled back and the account is untouched.
      // Aggregate-only trace. A failing audit must never turn a blocked
      // deletion into a completed one, hence fire-and-forget.
      writeAuditLog({
        req,
        userId,
        action: "account_delete_blocked",
        metadata: blockerAuditMetadata(err.blockerReport),
      });
      return sendSafeJsonError(
        res, 409, "account_deletion_blocked",
        "Deletion could not be completed safely and was rolled back.",
      );
    }
    if (err?.message === OWNER_ACCOUNT_DELETION_UNAVAILABLE) {
      // Rolled back completely; nothing was archived, deleted or revoked.
      return sendSafeJsonError(
        res, 409, OWNER_ACCOUNT_DELETION_UNAVAILABLE,
        "Account deletion is temporarily unavailable for practice owners.",
      );
    }
    if (err?.message === "account_not_found") {
      return sendSafeJsonError(res, 404, "account_not_found", "Account not found.");
    }
    // The archiving invariants failed. The internal detail names WHICH one and
    // stays in the log; the client gets the stable code and nothing else.
    if (err?.message === ARCHIVE_CONFLICT
      || err?.message === ARCHIVE_INCOMPLETE
      || err?.message === "account_deletion_incomplete") {
      logServerError("account/delete/lifecycle", err);
      return sendSafeJsonError(
        res, 409, err.message,
        "Deletion could not be completed safely and was rolled back.",
      );
    }
    logServerError("account/delete", err);
    return sendSafeJsonError(res, 500, "server_error", "Deletion could not be completed.");
  }
});

export default router;
