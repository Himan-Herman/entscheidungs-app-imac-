/**
 * GDPR-style account data export and targeted Pre-Visit / practice data deletion.
 *
 * Deletion levels (product surface area):
 * 1) Single Pre-Visit session — DELETE /api/previsit/sessions/:id
 * 2) Longitudinal case / timeline — use previsit cases API (user-scoped)
 * 3) Doctor contact — DELETE /api/user/doctor-contacts/:id
 * 4) Practice profile (owner) — DELETE /api/practices/:id
 * 5) All user-owned Pre-Visit-related data (this file) — DELETE /api/account/delete
 * 6) Full account removal — not implemented in v1; may be added with separate explicit confirmation
 *
 * This route only implements (5) for MedScoutX-stored B2B2C / pre-visit artifacts; the login user row is kept.
 */
import express from "express";
import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../services/auditLogService.js";
import { sendSafeJsonError, logServerError } from "../utils/safeApiError.js";
import {
  accountDeleteLimiter,
  accountExportLimiter,
} from "../middleware/ipRateLimit.js";
import { getBillingPlausibilityExportForUser } from "../services/billingPlausibility/billingPlausibilityService.js";

const prisma = new PrismaClient();
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

  writeAuditLog({
    req,
    userId,
    action: "account_data_delete_requested",
    metadata: { scope: "previsit_and_related" },
  });

  try {
    await prisma.$transaction(async (tx) => {
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

      await tx.practiceProfile.deleteMany({ where: { userId } });
      await tx.practiceMember.deleteMany({ where: { userId } });
      await tx.interpreterCloudSession.deleteMany({ where: { userId } });
      await tx.interpreterCloudPreference.deleteMany({ where: { userId } });
    });

    return res.json({ ok: true, deleted: true, scope: "user_previsit_practice_artifacts" });
  } catch (err) {
    logServerError("account/delete", err);
    return sendSafeJsonError(res, 500, "server_error", "Deletion could not be completed.");
  }
});

export default router;
