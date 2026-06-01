/**
 * Public anamnesis intake — no authentication required.
 * GET  /qr/:token  → validate link + return template structure
 * POST /qr/:token/submit → store submission (only after patient has granted consent)
 */

import express from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const VALID_LANGUAGES = new Set(["de", "en", "fr", "it", "es"]);

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const TEMPLATE_INCLUDE = {
  sections: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  },
};

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
      link: {
        id: link.id,
        label: link.label,
        expiresAt: link.expiresAt,
      },
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

  const { patientLanguage, answersJson } = req.body;

  if (!patientLanguage || !VALID_LANGUAGES.has(patientLanguage)) {
    return res.status(400).json({ ok: false, error: "invalid_language" });
  }
  if (!Array.isArray(answersJson)) {
    return res.status(400).json({ ok: false, error: "answers_required" });
  }
  if (answersJson.length > MAX_ANSWERS_ITEMS) {
    return res.status(400).json({ ok: false, error: "answers_too_large" });
  }

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

    const submission = await prisma.practiceAnamnesisSubmission.create({
      data: {
        practiceProfileId: link.practiceProfileId,
        templateId: link.templateId,
        linkId: link.id,
        patientLanguage,
        answersJson,
        consentGrantedAt: consentAt,
        consentVersion: "v1",
        status: "new",
      },
    });

    return res.status(201).json({ ok: true, submissionId: submission.id });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
