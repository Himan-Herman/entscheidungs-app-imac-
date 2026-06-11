/**
 * Practice read-only view of patient SOS-Karte.
 *
 * GET /api/practice/patients/:linkId/sos-card
 *
 * Requires: active PracticePatientLink + patient consent "sos_card_access"
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import { isSosCardEnabled } from "../config/featureFlags.js";
import { resolvePatientLinkForPractice } from "../services/careRelationship/resolvePatientLink.js";
import { assertConsentForLink } from "../services/consent/consentRecordService.js";

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

const LINK_ACTIVE = new Set(["invited", "active"]);

function requireFeature(_req, res, next) {
  if (!isSosCardEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

async function resolveLink(req, res) {
  const { linkId } = req.params;
  const practiceId = req.query.practiceId || "";
  const actorUserId = req.user?.userId;
  if (!practiceId || !actorUserId) {
    res.status(400).json({ ok: false, error: "missing_practice_id" });
    return null;
  }
  let link;
  try {
    link = await resolvePatientLinkForPractice(linkId, practiceId);
  } catch (err) {
    if (err?.message === "link_not_found") res.status(404).json({ ok: false, error: "link_not_found" });
    else res.status(400).json({ ok: false, error: "invalid_request" });
    return null;
  }
  if (!LINK_ACTIVE.has(link.status)) {
    res.status(403).json({ ok: false, error: "link_inactive" });
    return null;
  }
  return link;
}

router.use(requireFeature);

/** GET /api/practice/patients/:linkId/sos-card */
router.get("/", async (req, res) => {
  const link = await resolveLink(req, res);
  if (!link) return;

  try {
    await assertConsentForLink(link.id, "sos_card_access");
  } catch {
    return res.status(403).json({ ok: false, error: "no_consent" });
  }

  try {
    const [cardRow, allergies, diagnoses] = await Promise.all([
      prisma.sosCard.findUnique({ where: { patientUserId: link.patientUserId } }),
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
