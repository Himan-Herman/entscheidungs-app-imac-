/**
 * Public emergency endpoint — /api/public/emergency/:token
 * No authentication required. Rate-limited. Returns SOS card data for first responders.
 * Only returns data when patient has explicitly generated a public token.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import { isSosCardEnabled } from "../config/featureFlags.js";

const router = express.Router();
const prisma = new PrismaClient();

function requireFeature(_req, res, next) {
  if (!isSosCardEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

router.use(requireFeature);

/** GET /api/public/emergency/:token */
router.get("/:token", async (req, res) => {
  const { token } = req.params;
  if (typeof token !== "string" || token.length < 10 || token.length > 80) {
    return res.status(400).json({ ok: false, error: "invalid_token" });
  }

  try {
    const card = await prisma.sosCard.findUnique({
      where: { publicToken: token },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!card) {
      return res.status(404).json({ ok: false, error: "card_not_found" });
    }

    const [allergies, diagnoses] = await Promise.all([
      prisma.allergyEntry.findMany({
        where: { userId: card.patientUserId, deletedAt: null, status: { not: "inactive" } },
        select: { allergen: true, severity: true, reaction: true, allergyType: true },
        orderBy: { severity: "asc" },
      }),
      prisma.diagnosisEntry.findMany({
        where: {
          userId: card.patientUserId,
          deletedAt: null,
          status: { in: ["active", "chronic"] },
        },
        select: { condition: true, status: true, icdCode: true },
      }),
    ]);

    return res.json({
      ok: true,
      patient: {
        firstName: card.patient.firstName,
        lastName: card.patient.lastName,
      },
      bloodType: card.bloodType,
      emergencyContacts: [
        card.emergencyContact1Name && card.emergencyContact1Phone
          ? { name: card.emergencyContact1Name, phone: card.emergencyContact1Phone }
          : null,
        card.emergencyContact2Name && card.emergencyContact2Phone
          ? { name: card.emergencyContact2Name, phone: card.emergencyContact2Phone }
          : null,
      ].filter(Boolean),
      firstResponderNote: card.firstResponderNote,
      aiSummary: card.aiSummary,
      allergies,
      diagnoses,
    });
  } catch (err) {
    console.error("[public-emergency] error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
