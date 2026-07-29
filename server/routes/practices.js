import express from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../services/auditLogService.js";
import {
  CONTEXTUAL_DATA_BLOCKED,
  blockerAuditMetadata,
  checkPracticeDeletionBlockers,
} from "../services/dataLifecycle/contextualPatientDataDeletionGuard.js";
import {
  canManageIntegrations,
  canViewIntegrationSettings,
  getPracticeAccess,
} from "../utils/practiceAccess.js";
import { practiceLogoUrl } from "../utils/practiceBranding.js";
import {
  DOCUMENT_DELIVERY_MODES,
  PracticeWebhookEventType,
} from "../constants/practiceIntegrationWebhookEvents.js";
import {
  encryptWebhookSecretForStorage,
  fingerprintWebhookSecret,
  isIntegrationEncryptionConfigured,
} from "../utils/integrationCrypto.js";
import { enqueuePracticeWebhook } from "../services/practiceWebhookService.js";
import { trackAnalyticsEvent } from "../services/analyticsService.js";
import {
  ensureDemoPracticeProfileForUser,
  isPracticeDemoProfileEnabled,
} from "../services/practiceDemoProfileService.js";
import { assertPracticeMemberRoleMutationAllowed } from "../services/practiceTeam/practiceTeamService.js";
import {
  ARCHIVE_CONFLICT,
  ARCHIVE_INCOMPLETE,
  ARCHIVE_REASONS,
  deletePracticeWithArchivedContext,
} from "../services/dataLifecycle/archivePracticePatientContext.js";

const router = express.Router();

/**
 * Deleting a practice is irreversible and now moves other people's medical
 * records to an archive on the way. It requires the same kind of explicit
 * confirmation the account erasure does.
 */
const PRACTICE_DELETE_CONFIRM = "DELETE_THIS_PRACTICE";

const TARGET_TYPES = new Set([
  "practice",
  "doctor",
  "department",
  "appointment_type",
]);
const CALENDAR_PROVIDERS = new Set([
  "manual",
  "ics",
  "google_later",
  "microsoft_later",
]);
const PRACTICE_MEMBER_ROLES = new Set([
  "owner",
  "admin",
  "doctor",
  "secretary",
  "assistant",
  "practice_manager",
  "viewer",
]);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id ? id : null;
}

function normalizeSlug(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeOpt(v, max = 300) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function isValidEmail(v) {
  if (!v || typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function makeQrToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function profileJson(row) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    practiceName: row.practiceName,
    publicSlug: row.publicSlug,
    logoUrl: practiceLogoUrl(row),
    hasUploadedLogo: Boolean(row.logoStorageKey),
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    specialty: row.specialty,
    preferredDoctorLanguage: row.preferredDoctorLanguage,
    patientIntroText: row.patientIntroText,
    isActive: row.isActive,
  };
}

function targetJson(row) {
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
    qrToken: row.qrToken,
    isActive: row.isActive,
  };
}

function memberJson(row) {
  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    invitedAt: row.invitedAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function integrationSettingsResponse(row) {
  return {
    calendarEnabled: row.calendarEnabled,
    calendarProvider: row.calendarProvider,
    webhookEnabled: row.webhookEnabled,
    webhookUrl: row.webhookUrl,
    webhookSecretConfigured: Boolean(row.webhookSecretEnc),
    documentDeliveryMode: row.documentDeliveryMode,
    secureDownloadEnabled: row.secureDownloadEnabled,
  };
}

function defaultIntegrationSettingsShape() {
  return {
    calendarEnabled: false,
    calendarProvider: null,
    webhookEnabled: false,
    webhookUrl: null,
    webhookSecretConfigured: false,
    documentDeliveryMode: "secure_portal",
    secureDownloadEnabled: true,
  };
}

async function resolvePracticeAccess(userId, practiceId) {
  return getPracticeAccess(userId, practiceId);
}

function roleAllows(role, allowed) {
  return allowed.includes(role);
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    await ensureDemoPracticeProfileForUser(userId);
  } catch (err) {
    console.error("[practices] ensure demo profile failed:", err?.message || err);
  }
  const rows = await prisma.practiceProfile.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId, status: "active" } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
  return res.json({ ok: true, practices: rows.map(profileJson) });
});

router.post("/ensure-demo", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!isPracticeDemoProfileEnabled()) {
    return res.status(403).json({ ok: false, error: "demo_profile_disabled" });
  }
  try {
    const practice = await ensureDemoPracticeProfileForUser(userId);
    const rows = await prisma.practiceProfile.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId, status: "active" } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
    return res.json({
      ok: true,
      created: Boolean(practice),
      practice: practice ? profileJson(practice) : null,
      practices: rows.map(profileJson),
    });
  } catch (err) {
    console.error("[practices] POST ensure-demo failed:", err?.message || err);
    return res.status(500).json({ ok: false, error: "ensure_demo_failed" });
  }
});

router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const b = req.body || {};
  const practiceName = normalizeOpt(b.practiceName, 200);
  const publicSlug = normalizeSlug(b.publicSlug);
  const preferredDoctorLanguage = normalizeOpt(b.preferredDoctorLanguage, 12);
  if (!practiceName) return res.status(400).json({ ok: false, error: "practiceName_required" });
  if (!publicSlug) return res.status(400).json({ ok: false, error: "publicSlug_required" });
  if (!preferredDoctorLanguage) {
    return res.status(400).json({ ok: false, error: "preferredDoctorLanguage_required" });
  }
  const emailRaw = normalizeOpt(b.email, 254);
  if (emailRaw && !isValidEmail(emailRaw)) {
    return res.status(400).json({ ok: false, error: "email_invalid" });
  }
  try {
    const created = await prisma.practiceProfile.create({
      data: {
        userId,
        practiceName,
        publicSlug,
        logoUrl: normalizeOpt(b.logoUrl, 500),
        address: normalizeOpt(b.address, 500),
        phone: normalizeOpt(b.phone, 80),
        email: emailRaw ? emailRaw.toLowerCase() : null,
        website: normalizeOpt(b.website, 500),
        specialty: normalizeOpt(b.specialty, 160),
        preferredDoctorLanguage,
        patientIntroText: normalizeOpt(b.patientIntroText, 1200),
        isActive: b.isActive !== false,
        members: {
          create: {
            userId,
            role: "owner",
          },
        },
      },
    });
    writeAuditLog({
      req,
      userId,
      action: "practice_profile_created",
      entityType: "PracticeProfile",
      entityId: created.id,
      metadata: {},
    });
    void trackAnalyticsEvent({
      eventType: "practice_profile_created",
      userId,
      practiceId: created.id,
      metadata: {},
    });
    return res.status(201).json({ ok: true, practice: profileJson(created) });
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ ok: false, error: "publicSlug_exists" });
    }
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  return res.json({ ok: true, practice: profileJson(access.practice), role: access.role });
});

router.put("/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  if (!roleAllows(access.role, ["owner", "admin"])) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const existing = access.practice;
  const b = req.body || {};
  const data = {};
  if (Object.prototype.hasOwnProperty.call(b, "practiceName")) {
    const v = normalizeOpt(b.practiceName, 200);
    if (!v) return res.status(400).json({ ok: false, error: "practiceName_required" });
    data.practiceName = v;
  }
  if (Object.prototype.hasOwnProperty.call(b, "publicSlug")) {
    const v = normalizeSlug(b.publicSlug);
    if (!v) return res.status(400).json({ ok: false, error: "publicSlug_required" });
    data.publicSlug = v;
  }
  if (Object.prototype.hasOwnProperty.call(b, "preferredDoctorLanguage")) {
    const v = normalizeOpt(b.preferredDoctorLanguage, 12);
    if (!v) {
      return res.status(400).json({ ok: false, error: "preferredDoctorLanguage_required" });
    }
    data.preferredDoctorLanguage = v;
  }
  if (Object.prototype.hasOwnProperty.call(b, "email")) {
    const v = normalizeOpt(b.email, 254);
    if (v && !isValidEmail(v)) return res.status(400).json({ ok: false, error: "email_invalid" });
    data.email = v ? v.toLowerCase() : null;
  }
  if (Object.prototype.hasOwnProperty.call(b, "logoUrl")) data.logoUrl = normalizeOpt(b.logoUrl, 500);
  if (Object.prototype.hasOwnProperty.call(b, "address")) data.address = normalizeOpt(b.address, 500);
  if (Object.prototype.hasOwnProperty.call(b, "phone")) data.phone = normalizeOpt(b.phone, 80);
  if (Object.prototype.hasOwnProperty.call(b, "website")) data.website = normalizeOpt(b.website, 500);
  if (Object.prototype.hasOwnProperty.call(b, "specialty")) data.specialty = normalizeOpt(b.specialty, 160);
  if (Object.prototype.hasOwnProperty.call(b, "patientIntroText")) data.patientIntroText = normalizeOpt(b.patientIntroText, 1200);
  if (Object.prototype.hasOwnProperty.call(b, "isActive")) data.isActive = Boolean(b.isActive);
  try {
    const row = await prisma.practiceProfile.update({ where: { id: existing.id }, data });
    return res.json({ ok: true, practice: profileJson(row) });
  } catch (err) {
    if (err?.code === "P2002") return res.status(409).json({ ok: false, error: "publicSlug_exists" });
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "practice_not_found" });
  if (access.role !== "owner") {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  if (String(req.body?.confirmation ?? "").trim() !== PRACTICE_DELETE_CONFIRM) {
    return res.status(400).json({ ok: false, error: "confirmation_required" });
  }

  // Deleting a practice cascades to its PracticePatientLinks, and every
  // contextual medical record holds an ON DELETE RESTRICT key to its link. The
  // records are not the practice's to delete — they belong to the patient — so
  // they are moved to an immutable archive context first, inside this same
  // transaction. Document share grants hold three RESTRICT keys of their own
  // and are released here too.
  //
  // Everything happens in one transaction: an archive that committed without
  // the deletion would leave records detached from a practice that still
  // exists, and a deletion without the archive is what the database refuses.
  let summary;
  try {
    // One implementation, shared with account erasure: lock, archive, release
    // grants and tokens, run the guard as a postcondition, then delete.
    summary = await prisma.$transaction(async (tx) =>
      deletePracticeWithArchivedContext({
        transaction: tx,
        practiceProfileId: req.params.id,
        deletionReason: ARCHIVE_REASONS.PRACTICE_DELETED,
        deletingUserId: userId,
      }));
  } catch (err) {
    if (err?.message === "practice_not_found") {
      return res.status(404).json({ ok: false, error: "practice_not_found" });
    }
    if (err?.message === CONTEXTUAL_DATA_BLOCKED) {
      // Aggregate-only trace; a failing audit must not turn a blocked deletion
      // into a completed one.
      writeAuditLog({
        req,
        userId,
        actorRole: access.role,
        action: "practice_delete_blocked",
        entityType: "PracticeProfile",
        entityId: req.params.id,
        practiceProfileId: req.params.id,
        metadata: blockerAuditMetadata(err.blockerReport),
      });
      // Stable code only — no counts, categories or ids leave the server.
      return res.status(409).json({ ok: false, error: "practice_deletion_blocked" });
    }
    if (err?.message === ARCHIVE_CONFLICT || err?.message === ARCHIVE_INCOMPLETE) {
      // The internal detail explains WHICH invariant failed; it stays in the
      // log, never in the response.
      console.error("[practices/delete] archive", err.message, err.archiveDetail ?? "");
      return res.status(409).json({ ok: false, error: err.message });
    }
    console.error("[practices/delete]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }

  // Audit after the commit, from aggregate counts only: how many links were
  // archived, how many records per model moved, how many grants and tokens
  // ended. No patient, no link, no medical content.
  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "practice_patient_context_archived",
    entityType: "PracticeProfile",
    entityId: req.params.id,
    practiceProfileId: req.params.id,
    metadata: {
      archiveReason: ARCHIVE_REASONS.PRACTICE_DELETED,
      archivedLinks: summary.archived.archivedLinks,
      movedTotal: summary.archived.movedTotal,
      movedByModel: summary.archived.movedByModel,
    },
  });
  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "document_share_grants_revoked_for_deletion",
    entityType: "PracticeProfile",
    entityId: req.params.id,
    practiceProfileId: req.params.id,
    metadata: {
      reason: ARCHIVE_REASONS.PRACTICE_DELETED,
      grantsTouched: summary.grants.grantsTouched,
      grantsAsSource: summary.grants.grantsAsSource,
      grantsAsTarget: summary.grants.grantsAsTarget,
      grantsRevoked: summary.grants.grantsRevoked,
      grantsRemoved: summary.grants.grantsRemoved,
      tokensRevoked: summary.grants.tokensRevoked,
    },
  });
  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "practice_deletion_completed",
    entityType: "PracticeProfile",
    entityId: req.params.id,
    practiceProfileId: req.params.id,
    metadata: { archivedLinks: summary.archived.archivedLinks },
  });

  // No patient ids, no link ids, no counts of medical records.
  return res.json({ ok: true, deleted: true });
});

router.get("/:id/qr-targets", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  const rows = await prisma.practiceQrTarget.findMany({
    where: { practiceProfileId: access.practice.id },
    orderBy: { updatedAt: "desc" },
  });
  return res.json({ ok: true, targets: rows.map(targetJson) });
});

router.post("/:id/qr-targets", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  if (!roleAllows(access.role, ["owner", "admin"])) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const b = req.body || {};
  const targetName = normalizeOpt(b.targetName, 180);
  if (!targetName) return res.status(400).json({ ok: false, error: "targetName_required" });
  const targetType = normalizeOpt(b.targetType, 40) || "practice";
  if (!TARGET_TYPES.has(targetType)) return res.status(400).json({ ok: false, error: "targetType_invalid" });
  const recipientEmail = normalizeOpt(b.recipientEmail, 254);
  if (recipientEmail && !isValidEmail(recipientEmail)) {
    return res.status(400).json({ ok: false, error: "recipientEmail_invalid" });
  }
  const row = await prisma.practiceQrTarget.create({
    data: {
      practiceProfileId: access.practice.id,
      targetName,
      targetType,
      doctorName: normalizeOpt(b.doctorName, 180),
      specialty: normalizeOpt(b.specialty, 180),
      recipientEmail: recipientEmail ? recipientEmail.toLowerCase() : null,
      preferredDoctorLanguage: normalizeOpt(b.preferredDoctorLanguage, 12),
      qrToken: makeQrToken(),
      isActive: b.isActive !== false,
    },
  });
  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "qr_target_created",
    entityType: "PracticeQrTarget",
    entityId: row.id,
    metadata: { practiceProfileId: access.practice.id },
  });
  void trackAnalyticsEvent({
    eventType: "qr_target_created",
    userId,
    practiceId: access.practice.id,
    metadata: { targetType: row.targetType },
  });
  return res.status(201).json({ ok: true, target: targetJson(row) });
});

router.put("/:id/qr-targets/:targetId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  if (!roleAllows(access.role, ["owner", "admin"])) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const target = await prisma.practiceQrTarget.findFirst({
    where: { id: req.params.targetId, practiceProfileId: access.practice.id },
  });
  if (!target) return res.status(404).json({ ok: false, error: "target_not_found" });
  const b = req.body || {};
  const data = {};
  if (Object.prototype.hasOwnProperty.call(b, "targetName")) {
    const v = normalizeOpt(b.targetName, 180);
    if (!v) return res.status(400).json({ ok: false, error: "targetName_required" });
    data.targetName = v;
  }
  if (Object.prototype.hasOwnProperty.call(b, "targetType")) {
    const v = normalizeOpt(b.targetType, 40) || "";
    if (!TARGET_TYPES.has(v)) return res.status(400).json({ ok: false, error: "targetType_invalid" });
    data.targetType = v;
  }
  if (Object.prototype.hasOwnProperty.call(b, "recipientEmail")) {
    const v = normalizeOpt(b.recipientEmail, 254);
    if (v && !isValidEmail(v)) return res.status(400).json({ ok: false, error: "recipientEmail_invalid" });
    data.recipientEmail = v ? v.toLowerCase() : null;
  }
  if (Object.prototype.hasOwnProperty.call(b, "doctorName")) data.doctorName = normalizeOpt(b.doctorName, 180);
  if (Object.prototype.hasOwnProperty.call(b, "specialty")) data.specialty = normalizeOpt(b.specialty, 180);
  if (Object.prototype.hasOwnProperty.call(b, "preferredDoctorLanguage")) data.preferredDoctorLanguage = normalizeOpt(b.preferredDoctorLanguage, 12);
  if (Object.prototype.hasOwnProperty.call(b, "isActive")) data.isActive = Boolean(b.isActive);
  const row = await prisma.practiceQrTarget.update({ where: { id: target.id }, data });
  return res.json({ ok: true, target: targetJson(row) });
});

router.delete("/:id/qr-targets/:targetId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  if (!roleAllows(access.role, ["owner", "admin"])) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const result = await prisma.practiceQrTarget.deleteMany({
    where: { id: req.params.targetId, practiceProfileId: access.practice.id },
  });
  if (result.count === 0) return res.status(404).json({ ok: false, error: "target_not_found" });
  return res.json({ ok: true, deleted: true });
});

router.get("/:id/members", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  const rows = await prisma.practiceMember.findMany({
    where: { practiceProfileId: access.practice.id },
    orderBy: { createdAt: "asc" },
  });
  return res.json({ ok: true, members: rows.map(memberJson), role: access.role });
});

router.post("/:id/members", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  if (!roleAllows(access.role, ["owner", "admin"])) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const role = String(req.body?.role || "").trim();
  const memberUserId = String(req.body?.userId || "").trim();
  if (!memberUserId) return res.status(400).json({ ok: false, error: "userId_required" });
  if (!PRACTICE_MEMBER_ROLES.has(role)) {
    return res.status(400).json({ ok: false, error: "role_invalid" });
  }
  if (access.role !== "owner" && role === "owner") {
    return res.status(403).json({ ok: false, error: "forbidden_role_escalation" });
  }
  // The upsert rewrites an existing membership, so the actor's own userId in
  // the body would be a self role change through the back door.
  if (memberUserId === userId) {
    return res.status(403).json({ ok: false, error: "self_role_change_forbidden" });
  }
  const userExists = await prisma.user.findUnique({ where: { id: memberUserId }, select: { id: true } });
  if (!userExists) return res.status(404).json({ ok: false, error: "user_not_found" });
  const row = await prisma.practiceMember.upsert({
    where: {
      practiceProfileId_userId: {
        practiceProfileId: access.practice.id,
        userId: memberUserId,
      },
    },
    update: { role },
    create: {
      practiceProfileId: access.practice.id,
      userId: memberUserId,
      role,
      status: "active",
      acceptedAt: new Date(),
    },
  });
  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "practice_team_member_invited",
    entityType: "practice_membership",
    entityId: row.id,
    practiceProfileId: access.practice.id,
    metadata: { targetUserId: memberUserId, role, status: row.status, legacyRoute: true },
  });
  return res.status(201).json({ ok: true, member: memberJson(row) });
});

router.put("/:id/members/:memberId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  if (!roleAllows(access.role, ["owner", "admin"])) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const role = String(req.body?.role || "").trim();
  if (!PRACTICE_MEMBER_ROLES.has(role)) {
    return res.status(400).json({ ok: false, error: "role_invalid" });
  }
  const existing = await prisma.practiceMember.findFirst({
    where: { id: req.params.memberId, practiceProfileId: access.practice.id },
  });
  if (!existing) return res.status(404).json({ ok: false, error: "member_not_found" });
  if (existing.role === "owner" && access.role !== "owner") {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  if (access.role !== "owner" && role === "owner") {
    return res.status(403).json({ ok: false, error: "forbidden_role_escalation" });
  }
  try {
    // The same shared rule the team service uses: no self change, owner safe.
    assertPracticeMemberRoleMutationAllowed({
      actorUserId: userId,
      targetMember: { userId: existing.userId, practiceProfile: access.practice },
    });
  } catch (err) {
    const code = err?.message === "self_role_change_forbidden" ? 403 : 400;
    return res.status(code).json({ ok: false, error: err.message });
  }
  const conditional = await prisma.practiceMember.updateMany({
    where: { id: existing.id, role: existing.role, status: existing.status },
    data: { role },
  });
  if (conditional.count !== 1) {
    return res.status(409).json({ ok: false, error: "role_state_conflict" });
  }
  const row = await prisma.practiceMember.findUnique({ where: { id: existing.id } });
  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "practice_team_member_role_changed",
    entityType: "practice_membership",
    entityId: row.id,
    practiceProfileId: access.practice.id,
    metadata: { previousRole: existing.role, newRole: role, legacyRoute: true },
  });
  return res.json({ ok: true, member: memberJson(row) });
});

router.delete("/:id/members/:memberId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  if (!roleAllows(access.role, ["owner", "admin"])) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const existing = await prisma.practiceMember.findFirst({
    where: { id: req.params.memberId, practiceProfileId: access.practice.id },
  });
  if (!existing) return res.status(404).json({ ok: false, error: "member_not_found" });
  if (existing.role === "owner") {
    return res.status(400).json({ ok: false, error: "owner_member_cannot_be_deleted" });
  }
  // Aligned with the team service: nobody revokes their own membership here.
  if (existing.userId === userId) {
    return res.status(403).json({ ok: false, error: "cannot_revoke_self" });
  }
  const row = await prisma.practiceMember.update({
    where: { id: existing.id },
    data: { status: "revoked", revokedAt: new Date() },
  });
  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "practice_team_member_revoked",
    entityType: "practice_membership",
    entityId: row.id,
    practiceProfileId: access.practice.id,
    metadata: { targetUserId: row.userId, legacyRoute: true },
  });
  return res.json({ ok: true, deleted: true, member: memberJson(row) });
});

router.get("/:id/integration-settings", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access || !canViewIntegrationSettings(access.role)) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }
  const row = await prisma.practiceIntegrationSettings.findUnique({
    where: { practiceProfileId: access.practice.id },
  });
  const recentWebhookEvents = await prisma.practiceWebhookEvent.findMany({
    where: { practiceProfileId: access.practice.id },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      eventType: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
      deliveredAt: true,
      updatedAt: true,
    },
  });
  return res.json({
    ok: true,
    role: access.role,
    canManage: canManageIntegrations(access.role),
    encryptionReady: isIntegrationEncryptionConfigured(),
    settings: row ? integrationSettingsResponse(row) : defaultIntegrationSettingsShape(),
    recentWebhookEvents,
  });
});

router.put("/:id/integration-settings", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access || !canManageIntegrations(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const b = req.body || {};

  const documentDeliveryMode = String(b.documentDeliveryMode || "").trim();
  if (
    documentDeliveryMode &&
    !DOCUMENT_DELIVERY_MODES.includes(documentDeliveryMode)
  ) {
    return res.status(400).json({ ok: false, error: "documentDeliveryMode_invalid" });
  }

  let calendarProvider = null;
  if (Object.prototype.hasOwnProperty.call(b, "calendarProvider")) {
    const cp = b.calendarProvider === null || b.calendarProvider === ""
      ? null
      : String(b.calendarProvider).trim();
    if (cp && !CALENDAR_PROVIDERS.has(cp)) {
      return res.status(400).json({ ok: false, error: "calendarProvider_invalid" });
    }
    calendarProvider = cp;
  }

  const nextWebhookSecret = typeof b.webhookSecret === "string" ? b.webhookSecret.trim() : "";
  const clearWebhookSecret = Boolean(b.webhookSecretClear);
  if (nextWebhookSecret && clearWebhookSecret) {
    return res.status(400).json({ ok: false, error: "webhookSecret_conflict" });
  }
  if (nextWebhookSecret && !isIntegrationEncryptionConfigured()) {
    return res.status(503).json({
      ok: false,
      error: "integration_encryption_not_configured",
    });
  }

  const integrationDefaults = {
    calendarEnabled: false,
    calendarProvider: null,
    webhookEnabled: false,
    webhookUrl: null,
    webhookSecretEnc: null,
    webhookSecretHash: null,
    documentDeliveryMode: "secure_portal",
    secureDownloadEnabled: true,
  };

  const data = {};
  if (Object.prototype.hasOwnProperty.call(b, "calendarEnabled")) {
    data.calendarEnabled = Boolean(b.calendarEnabled);
  }
  if (Object.prototype.hasOwnProperty.call(b, "calendarProvider")) {
    data.calendarProvider = calendarProvider;
  }
  if (Object.prototype.hasOwnProperty.call(b, "webhookEnabled")) {
    data.webhookEnabled = Boolean(b.webhookEnabled);
  }
  if (Object.prototype.hasOwnProperty.call(b, "webhookUrl")) {
    const url = normalizeOpt(b.webhookUrl, 2000);
    data.webhookUrl = url;
  }
  if (documentDeliveryMode) {
    data.documentDeliveryMode = documentDeliveryMode;
  }
  if (Object.prototype.hasOwnProperty.call(b, "secureDownloadEnabled")) {
    data.secureDownloadEnabled = Boolean(b.secureDownloadEnabled);
  }

  if (clearWebhookSecret) {
    data.webhookSecretEnc = null;
    data.webhookSecretHash = null;
  } else   if (nextWebhookSecret) {
    const enc = encryptWebhookSecretForStorage(nextWebhookSecret);
    if (!enc) {
      return res.status(503).json({
        ok: false,
        error: "integration_encryption_failed",
      });
    }
    data.webhookSecretEnc = enc;
    data.webhookSecretHash = fingerprintWebhookSecret(nextWebhookSecret);
  }

  if (Object.keys(data).length === 0) {
    const existing = await prisma.practiceIntegrationSettings.findUnique({
      where: { practiceProfileId: access.practice.id },
    });
    return res.json({
      ok: true,
      settings: existing
        ? integrationSettingsResponse(existing)
        : defaultIntegrationSettingsShape(),
      encryptionReady: isIntegrationEncryptionConfigured(),
    });
  }

  const saved = await prisma.practiceIntegrationSettings.upsert({
    where: { practiceProfileId: access.practice.id },
    create: {
      practiceProfileId: access.practice.id,
      ...integrationDefaults,
      ...data,
    },
    update: data,
  });

  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "practice_integration_settings_updated",
    entityType: "PracticeIntegrationSettings",
    entityId: saved.id,
    metadata: { practiceProfileId: access.practice.id },
  });

  return res.json({
    ok: true,
    settings: integrationSettingsResponse(saved),
    encryptionReady: isIntegrationEncryptionConfigured(),
  });
});

router.post("/:id/integration-settings/webhook-test", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const access = await resolvePracticeAccess(userId, req.params.id);
  if (!access || !canManageIntegrations(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  try {
    const row = await enqueuePracticeWebhook({
      practiceProfileId: access.practice.id,
      eventType: PracticeWebhookEventType.WEBHOOK_TEST,
      payload: { source: "settings_ui" },
    });
    return res.status(201).json({
      ok: true,
      webhookEventId: row.id,
    });
  } catch {
    return res.status(500).json({ ok: false, error: "enqueue_failed" });
  }
});

export default router;

