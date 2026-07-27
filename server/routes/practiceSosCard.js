/**
 * Practice read-only view of patient SOS-Karte.
 *
 * GET /api/practice/patients/:linkId/sos-card
 *
 * Requires: active PracticePatientLink + patient consent "sos_card_access"
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isSosCardEnabled } from "../config/featureFlags.js";
import { requirePracticePatientLinkAccess } from "../services/authorization/practicePatientLinkAuthorization.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import {
  computeAge,
  plausibleHeightCm,
  plausibleWeightKg,
} from "../services/sosCard/sosCardEmergencyData.js";

const router = express.Router({ mergeParams: true });

function requireFeature(_req, res, next) {
  if (!isSosCardEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

router.use(requireFeature);

/**
 * GET /api/practice/patients/:linkId/sos-card
 *
 * The consent gate previously passed `link.id` (a string) instead of the link
 * object, so the check crashed into "deny" for the wrong reason. Consent is now
 * evaluated centrally against the loaded link.
 *
 * NOTE: "sos_card_access" is not part of CONSENT_TYPES and is not granted
 * anywhere in the codebase, so this route still denies every request — now for
 * the correct reason (no consent record can exist). Introducing the consent
 * type plus a patient-facing way to grant it is a feature change and is
 * deliberately out of scope for this security patch; it must not be widened
 * into an implicit grant.
 */
router.get("/", requirePracticePatientLinkAccess({
  permission: PERMISSIONS.CLINICAL_SOS_READ,
  consentType: "sos_card_access",
}), async (req, res) => {
  const { link } = req.linkAccess;

  try {
    const [cardRow, patientUser, allergies, diagnoses] = await Promise.all([
      prisma.sosCard.findUnique({ where: { patientUserId: link.patientUserId } }),
      prisma.user.findUnique({
        where: { id: link.patientUserId },
        select: { dateOfBirth: true, profile: { select: { heightCm: true, weightKg: true } } },
      }),
      prisma.allergyEntry.findMany({
        where: { userId: link.patientUserId, deletedAt: null, status: { not: "inactive" } },
        select: { allergen: true, severity: true, reaction: true, allergyType: true },
        orderBy: { severity: "asc" },
      }),
      prisma.diagnosisEntry.findMany({
        where: {
          userId: link.patientUserId,
          deletedAt: null,
          status: { in: ["active", "chronic"] },
        },
        select: { conditionName: true, status: true, icdCode: true },
      }),
    ]);

    // Soft-deleted card behaves as absent. The public field-level visibility flags (show*) are
    // intentionally NOT applied here: practice access is already gated by an explicit, separate
    // patient consent ("sos_card_access") and a treatment relationship, which is a different trust
    // context from the anonymous public QR page. Consent stays the single gate for practices.
    const card = cardRow && !cardRow.deletedAt ? cardRow : null;

    return res.json({
      ok: true,
      // Patient self-reported; no medical verification exists.
      selfReported: true,
      // Age / height / weight referenced read-only from the profile, never stored on the card.
      age: computeAge(patientUser?.dateOfBirth),
      dateOfBirth: patientUser?.dateOfBirth ?? null,
      heightCm: plausibleHeightCm(patientUser?.profile?.heightCm),
      weightKg: plausibleWeightKg(patientUser?.profile?.weightKg),
      card: card
        ? {
            bloodType: card.bloodType,
            emergencyContact1Name: card.emergencyContact1Name,
            emergencyContact1Phone: card.emergencyContact1Phone,
            emergencyContact2Name: card.emergencyContact2Name,
            emergencyContact2Phone: card.emergencyContact2Phone,
            firstResponderNote: card.firstResponderNote,
            medications: Array.isArray(card.medicationsJson) ? card.medicationsJson : [],
            implants: Array.isArray(card.implantsJson) ? card.implantsJson : [],
            emergencyBiologicalSex: card.emergencyBiologicalSex || null,
            pregnancyStatus: card.pregnancyStatus || null,
            preferredEmergencyLanguage: card.preferredEmergencyLanguage || null,
            aiSummary: card.aiSummary,
            aiSummaryUpdatedAt: card.aiSummaryUpdatedAt,
          }
        : null,
      allergies,
      diagnoses: diagnoses.map((d) => ({
        condition: d.conditionName,
        status: d.status,
        icdCode: d.icdCode,
      })),
    });
  } catch (err) {
    console.error("[practice-sos-card] error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
