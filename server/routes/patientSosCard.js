/**
 * Patient Notfallausweis / SOS-Karte — /api/patient/sos-card
 *
 * GET    /api/patient/sos-card               — fetch or return empty card
 * PUT    /api/patient/sos-card               — upsert card data
 * POST   /api/patient/sos-card/generate-token — generate / rotate public QR token
 * DELETE /api/patient/sos-card/revoke-token  — revoke public token (disable QR)
 * POST   /api/patient/sos-card/ai-summary    — trigger gpt-4o-mini summary
 */

import { randomUUID } from "crypto";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { isSosCardEnabled } from "../config/featureFlags.js";
import { generateSosCardSummary } from "../services/sosCard/sosCardAiSummary.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();
const prisma = new PrismaClient();

const BLOOD_TYPES = new Set([
  "A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-",
  "O+", "O-",
]);

function uid(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isSosCardEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

function sanitizeCard(row) {
  if (!row) return null;
  return {
    id: row.id,
    bloodType: row.bloodType,
    emergencyContact1Name: row.emergencyContact1Name,
    emergencyContact1Phone: row.emergencyContact1Phone,
    emergencyContact2Name: row.emergencyContact2Name,
    emergencyContact2Phone: row.emergencyContact2Phone,
    firstResponderNote: row.firstResponderNote,
    aiSummary: row.aiSummary,
    aiSummaryUpdatedAt: row.aiSummaryUpdatedAt,
    hasPublicToken: Boolean(row.publicToken),
    tokenGeneratedAt: row.tokenGeneratedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.use(requireFeature);

/** GET /api/patient/sos-card */
router.get("/", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const card = await prisma.sosCard.findUnique({ where: { patientUserId: userId } });
    return res.json({ ok: true, card: sanitizeCard(card) });
  } catch (err) {
    console.error("[sos-card] get error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** PUT /api/patient/sos-card */
router.put("/", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const {
    bloodType,
    emergencyContact1Name,
    emergencyContact1Phone,
    emergencyContact2Name,
    emergencyContact2Phone,
    firstResponderNote,
  } = req.body || {};

  if (bloodType !== undefined && bloodType !== null && bloodType !== "" && !BLOOD_TYPES.has(bloodType)) {
    return res.status(400).json({ ok: false, error: "invalid_blood_type" });
  }

  const data = {
    bloodType: bloodType || null,
    emergencyContact1Name: emergencyContact1Name?.trim().slice(0, 120) || null,
    emergencyContact1Phone: emergencyContact1Phone?.trim().slice(0, 40) || null,
    emergencyContact2Name: emergencyContact2Name?.trim().slice(0, 120) || null,
    emergencyContact2Phone: emergencyContact2Phone?.trim().slice(0, 40) || null,
    firstResponderNote: firstResponderNote?.trim().slice(0, 1000) || null,
  };

  try {
    const card = await prisma.sosCard.upsert({
      where: { patientUserId: userId },
      update: data,
      create: { patientUserId: userId, ...data },
    });

    await writeAuditLog({
      actorUserId: userId,
      actorRole: "patient",
      action: "sos_card_updated",
      targetUserId: userId,
    });

    return res.json({ ok: true, card: sanitizeCard(card) });
  } catch (err) {
    console.error("[sos-card] put error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /api/patient/sos-card/generate-token */
router.post("/generate-token", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const token = randomUUID();
    const card = await prisma.sosCard.upsert({
      where: { patientUserId: userId },
      update: { publicToken: token, tokenGeneratedAt: new Date() },
      create: { patientUserId: userId, publicToken: token, tokenGeneratedAt: new Date() },
    });

    await writeAuditLog({
      actorUserId: userId,
      actorRole: "patient",
      action: "sos_card_token_generated",
      targetUserId: userId,
    });

    return res.json({ ok: true, publicToken: card.publicToken, tokenGeneratedAt: card.tokenGeneratedAt });
  } catch (err) {
    console.error("[sos-card] generate-token error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** DELETE /api/patient/sos-card/revoke-token */
router.delete("/revoke-token", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    await prisma.sosCard.updateMany({
      where: { patientUserId: userId },
      data: { publicToken: null, tokenGeneratedAt: null },
    });

    await writeAuditLog({
      actorUserId: userId,
      actorRole: "patient",
      action: "sos_card_token_revoked",
      targetUserId: userId,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[sos-card] revoke-token error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /api/patient/sos-card/ai-summary */
router.post("/ai-summary", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ ok: false, error: "openai_not_configured" });
  }

  try {
    const [card, allergies, diagnoses] = await Promise.all([
      prisma.sosCard.findUnique({ where: { patientUserId: userId } }),
      prisma.allergyEntry.findMany({
        where: { userId, deletedAt: null },
        select: { allergen: true, severity: true, reaction: true },
      }),
      prisma.diagnosisEntry.findMany({
        where: { userId, deletedAt: null },
        select: { condition: true, status: true },
      }),
    ]);

    const summary = await generateSosCardSummary({
      bloodType: card?.bloodType,
      allergies,
      diagnoses,
      emergencyContact1Name: card?.emergencyContact1Name,
      emergencyContact1Phone: card?.emergencyContact1Phone,
      emergencyContact2Name: card?.emergencyContact2Name,
      emergencyContact2Phone: card?.emergencyContact2Phone,
      firstResponderNote: card?.firstResponderNote,
    });

    const updated = await prisma.sosCard.upsert({
      where: { patientUserId: userId },
      update: { aiSummary: summary, aiSummaryUpdatedAt: new Date() },
      create: {
        patientUserId: userId,
        aiSummary: summary,
        aiSummaryUpdatedAt: new Date(),
      },
    });

    return res.json({ ok: true, aiSummary: updated.aiSummary, aiSummaryUpdatedAt: updated.aiSummaryUpdatedAt });
  } catch (err) {
    console.error("[sos-card] ai-summary error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
