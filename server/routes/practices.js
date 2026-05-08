import express from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

const TARGET_TYPES = new Set([
  "practice",
  "doctor",
  "department",
  "appointment_type",
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

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const rows = await prisma.practiceProfile.findMany({
    where: { userId },
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
      },
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
  const row = await prisma.practiceProfile.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!row) return res.status(404).json({ ok: false, error: "not_found" });
  return res.json({ ok: true, practice: profileJson(row) });
});

router.put("/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const existing = await prisma.practiceProfile.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });
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
  const result = await prisma.practiceProfile.deleteMany({
    where: { id: req.params.id, userId },
  });
  if (result.count === 0) return res.status(404).json({ ok: false, error: "not_found" });
  return res.json({ ok: true, deleted: true });
});

router.get("/:id/qr-targets", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const owner = await prisma.practiceProfile.findFirst({ where: { id: req.params.id, userId } });
  if (!owner) return res.status(404).json({ ok: false, error: "not_found" });
  const rows = await prisma.practiceQrTarget.findMany({
    where: { practiceProfileId: owner.id },
    orderBy: { updatedAt: "desc" },
  });
  return res.json({ ok: true, targets: rows.map(targetJson) });
});

router.post("/:id/qr-targets", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const owner = await prisma.practiceProfile.findFirst({ where: { id: req.params.id, userId } });
  if (!owner) return res.status(404).json({ ok: false, error: "not_found" });
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
      practiceProfileId: owner.id,
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
  return res.status(201).json({ ok: true, target: targetJson(row) });
});

router.put("/:id/qr-targets/:targetId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const owner = await prisma.practiceProfile.findFirst({ where: { id: req.params.id, userId } });
  if (!owner) return res.status(404).json({ ok: false, error: "not_found" });
  const target = await prisma.practiceQrTarget.findFirst({
    where: { id: req.params.targetId, practiceProfileId: owner.id },
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
  const owner = await prisma.practiceProfile.findFirst({ where: { id: req.params.id, userId } });
  if (!owner) return res.status(404).json({ ok: false, error: "not_found" });
  const result = await prisma.practiceQrTarget.deleteMany({
    where: { id: req.params.targetId, practiceProfileId: owner.id },
  });
  if (result.count === 0) return res.status(404).json({ ok: false, error: "target_not_found" });
  return res.json({ ok: true, deleted: true });
});

export default router;

