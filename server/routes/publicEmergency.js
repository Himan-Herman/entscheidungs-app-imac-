/**
 * Public emergency endpoint — /api/public/emergency/:token
 * No authentication required. Rate-limited. Returns SOS card data for first responders.
 * Only returns data when patient has explicitly generated a public token.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import { isSosCardEnabled } from "../config/featureFlags.js";
import { writeAuditLog } from "../services/auditLogService.js";
import {
  computeAge,
  plausibleHeightCm,
  plausibleWeightKg,
  asEmergencyList,
} from "../services/sosCard/sosCardEmergencyData.js";

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
            dateOfBirth: true,
            profile: { select: { heightCm: true, weightKg: true } },
          },
        },
      },
    });

    // Soft-deleted cards behave as if they do not exist.
    if (!card || card.deletedAt) {
      return res.status(404).json({ ok: false, error: "card_not_found" });
    }

    // Expired share link → deny without leaking any health data.
    if (card.publicTokenExpiresAt && card.publicTokenExpiresAt.getTime() <= Date.now()) {
      return res.status(404).json({ ok: false, error: "card_not_found" });
    }

    // Only query data the patient chose to expose.
    const [allergies, diagnoses] = await Promise.all([
      card.showAllergies
        ? prisma.allergyEntry.findMany({
            where: { userId: card.patientUserId, deletedAt: null, status: { not: "inactive" } },
            select: { allergen: true, severity: true, reaction: true, allergyType: true },
            orderBy: { severity: "asc" },
          })
        : Promise.resolve([]),
      card.showDiagnoses
        ? prisma.diagnosisEntry.findMany({
            where: {
              userId: card.patientUserId,
              deletedAt: null,
              status: { in: ["active", "chronic"] },
            },
            select: { conditionName: true, status: true, icdCode: true },
          })
        : Promise.resolve([]),
    ]);

    // Fire-and-forget public-access audit. Hashes IP/UA inside writeAuditLog; never blocks the
    // emergency response and stores no health data. A logging failure must not deny access.
    try {
      writeAuditLog({
        req,
        action: "sos_card_public_accessed",
        entityType: "sos_card",
        entityId: card.id,
        patientUserId: card.patientUserId,
        severity: "info",
        visibility: "internal",
      });
    } catch {
      /* logging must never break emergency access */
    }

    // Referenced read-only profile data (not stored on the card).
    const age = computeAge(card.patient.dateOfBirth);
    const heightCm = plausibleHeightCm(card.patient.profile?.heightCm);
    const weightKg = plausibleWeightKg(card.patient.profile?.weightKg);

    return res.json({
      ok: true,
      // All values are patient self-reported; no medical verification exists.
      selfReported: true,
      patient: {
        firstName: card.patient.firstName,
        lastName: card.patient.lastName,
      },
      age: card.showAge ? age : null,
      dateOfBirth: card.showDateOfBirth ? card.patient.dateOfBirth : null,
      biologicalSex: card.showBiologicalSex ? card.emergencyBiologicalSex || null : null,
      bloodType: card.showBloodType ? card.bloodType : null,
      heightCm: card.showHeight ? heightCm : null,
      weightKg: card.showWeight ? weightKg : null,
      pregnancyStatus: card.showPregnancyStatus ? card.pregnancyStatus || null : null,
      emergencyContacts: card.showEmergencyContacts
        ? [
            card.emergencyContact1Name && card.emergencyContact1Phone
              ? { name: card.emergencyContact1Name, phone: card.emergencyContact1Phone }
              : null,
            card.emergencyContact2Name && card.emergencyContact2Phone
              ? { name: card.emergencyContact2Name, phone: card.emergencyContact2Phone }
              : null,
          ].filter(Boolean)
        : [],
      firstResponderNote: card.showFirstResponderNote ? card.firstResponderNote : null,
      aiSummary: card.showAiSummary ? card.aiSummary : null,
      medications: card.showMedications ? asEmergencyList(card.medicationsJson) : [],
      implants: card.showImplants ? asEmergencyList(card.implantsJson) : [],
      preferredEmergencyLanguage: card.showPreferredLanguage
        ? card.preferredEmergencyLanguage || null
        : null,
      // Response key stays "condition" for the frontend; DB column is conditionName.
      allergies,
      diagnoses: diagnoses.map((d) => ({
        condition: d.conditionName,
        status: d.status,
        icdCode: d.icdCode,
      })),
    });
  } catch (err) {
    console.error("[public-emergency] error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
