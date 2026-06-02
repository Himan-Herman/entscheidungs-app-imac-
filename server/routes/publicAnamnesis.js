/**
 * Public anamnesis intake — no authentication required.
 * GET  /qr/:token        → validate link + return template structure
 * POST /qr/:token/submit → store submission after patient consent
 */

import express from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { translateAnamnesisSubmission } from "../services/practiceAnamnesis/anamnesisTranslationService.js";
import { translateQuestionLabels } from "../services/practiceAnamnesis/questionLabelTranslationService.js";

const router = express.Router();
const prisma = new PrismaClient();

// Extended language set for anamnesis communication — superset of the global UI locales.
// Includes ja/ko/zh which are not in LOCALE_OPTIONS but are valid for patient communication.
const ANAMNESIS_VALID_LANGUAGES = new Set([
  "de", "en", "fr", "es", "it",
  "ru", "uk", "tr", "pt", "ar", "fa", "pl", "ro", "nl",
  "ckb", "ku", "el", "sq", "hr", "bs", "sr", "he", "ur",
  "ja", "ko", "zh",
]);
const VALID_INSURANCE_TYPES = new Set(["gkv", "pkv", "self_pay", "other", ""]);

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const TEMPLATE_INCLUDE = {
  sections: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  },
};

function sanitizeString(v, maxLen = 200) {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, maxLen);
  return s || null;
}

function validatePatientInfo(info) {
  if (!info || typeof info !== "object") return { ok: false, error: "patient_info_required" };
  if (!sanitizeString(info.firstName)) return { ok: false, error: "patient_first_name_required" };
  if (!sanitizeString(info.lastName)) return { ok: false, error: "patient_last_name_required" };
  if (!sanitizeString(info.dateOfBirth)) return { ok: false, error: "patient_dob_required" };
  // Validate dateOfBirth is a parseable date
  if (isNaN(new Date(info.dateOfBirth).getTime())) return { ok: false, error: "patient_dob_invalid" };
  if (info.insuranceType && !VALID_INSURANCE_TYPES.has(info.insuranceType)) {
    return { ok: false, error: "patient_insurance_type_invalid" };
  }
  return { ok: true };
}

function sanitizePatientInfo(info) {
  return {
    firstName: sanitizeString(info.firstName, 100),
    lastName: sanitizeString(info.lastName, 100),
    dateOfBirth: sanitizeString(info.dateOfBirth, 20),
    email: sanitizeString(info.email, 200) || null,
    phone: sanitizeString(info.phone, 50) || null,
    insuranceType: sanitizeString(info.insuranceType, 20) || null,
    insuranceName: sanitizeString(info.insuranceName, 200) || null,
    insuranceNumber: sanitizeString(info.insuranceNumber, 100) || null,
  };
}

// ── GET /qr/:token ─────────────────────────────────────────────────────────────

router.get("/qr/:token", async (req, res) => {
  const { token } = req.params;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return res.status(404).json({ ok: false, error: "link_not_found" });
  }
  try {
    const tokenHash = hashToken(token);
    const link = await prisma.practiceAnamnesisLink.findUnique({
      where: { tokenHash },
      include: {
        practiceProfile: {
          select: {
            practiceName: true,
            displayNameForPatients: true,
            city: true,
            logoUrl: true,
            preferredDoctorLanguage: true,
            supportedLanguages: true,
          },
        },
        template: {
          include: TEMPLATE_INCLUDE,
        },
      },
    });

    if (!link) return res.status(404).json({ ok: false, error: "link_not_found" });
    if (!link.isActive) return res.status(410).json({ ok: false, error: "link_disabled" });
    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(410).json({ ok: false, error: "link_expired" });
    }
    if (!link.template || link.template.status !== "active") {
      return res.status(410).json({ ok: false, error: "template_unavailable" });
    }

    return res.json({
      ok: true,
      link: { id: link.id, label: link.label, expiresAt: link.expiresAt },
      template: link.template,
      practice: link.practiceProfile,
    });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

// ── POST /qr/:token/submit ─────────────────────────────────────────────────────

const MAX_ANSWERS_ITEMS = 500;

router.post("/qr/:token/submit", async (req, res) => {
  const { token } = req.params;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return res.status(404).json({ ok: false, error: "link_not_found" });
  }

  const { patientLanguage, answersJson, patientInfo, doctorLanguage, consentScopes } = req.body;

  if (!patientLanguage || !ANAMNESIS_VALID_LANGUAGES.has(patientLanguage)) {
    return res.status(400).json({ ok: false, error: "invalid_language" });
  }
  if (!Array.isArray(answersJson)) {
    return res.status(400).json({ ok: false, error: "answers_required" });
  }
  if (answersJson.length > MAX_ANSWERS_ITEMS) {
    return res.status(400).json({ ok: false, error: "answers_too_large" });
  }

  // Validate and sanitize patient personal data
  const patientInfoValidation = validatePatientInfo(patientInfo);
  if (!patientInfoValidation.ok) {
    return res.status(400).json({ ok: false, error: patientInfoValidation.error });
  }
  const cleanPatientInfo = sanitizePatientInfo(patientInfo);

  // doctorLanguage is optional, validate if provided
  const cleanDoctorLanguage = (typeof doctorLanguage === "string" && ANAMNESIS_VALID_LANGUAGES.has(doctorLanguage))
    ? doctorLanguage : null;

  // consentScopes is optional array of strings
  const cleanConsentScopes = Array.isArray(consentScopes)
    ? consentScopes.filter((s) => typeof s === "string").slice(0, 20)
    : null;

  const consentAt = new Date();

  try {
    const tokenHash = hashToken(token);
    const link = await prisma.practiceAnamnesisLink.findUnique({
      where: { tokenHash },
      include: {
        template: { select: { id: true, status: true, practiceProfileId: true } },
      },
    });

    if (!link) return res.status(404).json({ ok: false, error: "link_not_found" });
    if (!link.isActive) return res.status(410).json({ ok: false, error: "link_disabled" });
    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(410).json({ ok: false, error: "link_expired" });
    }
    if (!link.template || link.template.status !== "active") {
      return res.status(410).json({ ok: false, error: "template_unavailable" });
    }

    // Validate answer lengths against per-question responseMaxLength (default 500 for text/textarea)
    if (answersJson.length > 0) {
      const allQuestions = await prisma.practiceAnamnesisQuestion.findMany({
        where: { templateId: link.templateId },
        select: { id: true, type: true, responseMaxLength: true },
      });
      const qMap = new Map(allQuestions.map((q) => [q.id, q]));
      for (const ans of answersJson) {
        if (typeof ans.value !== "string" || !ans.value.length) continue;
        if (typeof ans.questionId !== "string") continue;
        const q = qMap.get(ans.questionId);
        if (!q || (q.type !== "text" && q.type !== "textarea")) continue;
        const limit = q.responseMaxLength ?? 500;
        if (ans.value.length > limit) {
          return res.status(400).json({ ok: false, error: "answer_too_long", questionId: ans.questionId, limit });
        }
      }
    }

    const submission = await prisma.practiceAnamnesisSubmission.create({
      data: {
        practiceProfileId: link.practiceProfileId,
        templateId: link.templateId,
        linkId: link.id,
        patientLanguage,
        doctorLanguage: cleanDoctorLanguage,
        patientInfoJson: cleanPatientInfo,
        answersJson,
        consentGrantedAt: consentAt,
        consentVersion: "v1",
        consentScopes: cleanConsentScopes,
        status: "new",
      },
    });

    // Respond immediately — translation runs asynchronously and never blocks the patient
    setImmediate(() => {
      translateAnamnesisSubmission(submission.id).catch((err) => {
        console.warn("[publicAnamnesis] async translation error:", err?.message);
      });
    });

    return res.status(201).json({ ok: true, submissionId: submission.id });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

// ── POST /qr/:token/translate-labels ──────────────────────────────────────────
// Translates question labels into the patient's language before showing the form.
// Data minimization: only question text + language codes are sent to the AI.
// No patient personal data, no submission IDs, no practice IDs are forwarded.

router.post("/qr/:token/translate-labels", async (req, res) => {
  const { token } = req.params;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return res.status(404).json({ ok: false, error: "link_not_found" });
  }

  const { targetLang, sourceLang, labels } = req.body;

  if (!targetLang || !ANAMNESIS_VALID_LANGUAGES.has(targetLang)) {
    return res.status(400).json({ ok: false, error: "invalid_language" });
  }
  if (!Array.isArray(labels) || labels.length === 0) {
    return res.status(400).json({ ok: false, error: "labels_required" });
  }
  if (labels.length > 60) {
    return res.status(400).json({ ok: false, error: "too_many_labels" });
  }

  // Verify token is valid
  try {
    const tokenHash = hashToken(token);
    const link = await prisma.practiceAnamnesisLink.findUnique({
      where: { tokenHash },
      select: { id: true, isActive: true, expiresAt: true },
    });
    if (!link || !link.isActive) {
      return res.status(404).json({ ok: false, error: "link_not_found" });
    }
    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(410).json({ ok: false, error: "link_expired" });
    }
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }

  const cleanSourceLang = (typeof sourceLang === "string" && ANAMNESIS_VALID_LANGUAGES.has(sourceLang))
    ? sourceLang : "de";

  const safeLabels = labels
    .slice(0, 60)
    .filter((l) => l && typeof l.id === "string" && typeof l.text === "string" && l.text.trim())
    .map((l) => ({ id: l.id.slice(0, 100), text: l.text.slice(0, 300) }));

  if (!safeLabels.length) {
    return res.json({ ok: true, translations: [], translationAvailable: false });
  }

  const translations = await translateQuestionLabels(safeLabels, targetLang, cleanSourceLang);

  return res.json({
    ok: true,
    translations: translations || [],
    translationAvailable: translations !== null,
  });
});

export default router;
