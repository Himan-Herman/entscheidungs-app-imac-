import express from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../services/auditLogService.js";

const prisma = new PrismaClient();
const router = express.Router();

const TARGET_TYPES = new Set([
  "practice",
  "doctor",
  "department",
  "appointment_type",
]);
const PRACTICE_MEMBER_ROLES = new Set([
  "owner",
  "admin",
  "doctor",
  "assistant",
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
    logoUrl: row.logoUrl,
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
    createdAt: row.createdAt,
  };
}

async function resolvePracticeAccess(userId, practiceId) {
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
  });
  if (!practice) return null;
  if (practice.userId === userId) return { practice, role: "owner" };
  const member = await prisma.practiceMember.findUnique({
    where: { practiceProfileId_userId: { practiceProfileId: practiceId, userId } },
  });
  if (!member) return null;
  return { practice, role: member.role };
}

function roleAllows(role, allowed) {
  return allowed.includes(role);
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const rows = await prisma.practiceProfile.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
  return res.json({ ok: true, practices: rows.map(profileJson) });
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
  if (!access) return res.status(404).json({ ok: false, error: "not_found" });
  if (access.role !== "owner") {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const result = await prisma.practiceProfile.deleteMany({
    where: { id: req.params.id },
  });
  if (result.count === 0) return res.status(404).json({ ok: false, error: "not_found" });
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
    },
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
  const row = await prisma.practiceMember.update({
    where: { id: existing.id },
    data: { role },
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
  await prisma.practiceMember.delete({ where: { id: existing.id } });
  return res.json({ ok: true, deleted: true });
});

export default router;

