/**
 * Practice read-only view of a patient's shared vaccination entries.
 * GET /api/practice/patients/:linkId/vaccinations
 *
 * Requires:
 *  - Practice authentication (requireAuth applied in app.js)
 *  - Active PracticePatientLink between practice and patient
 *  - Patient consent scope "vaccinations" (consent type "vaccinations_access")
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isVaccinationPassEnabled } from "../config/featureFlags.js";
import { resolvePatientLinkForPractice } from "../services/careRelationship/resolvePatientLink.js";
import { assertConsentForLink } from "../services/consent/consentRecordService.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router({ mergeParams: true });

const LINK_ACTIVE = new Set(["invited", "active"]);

function requireFeature(_req, res, next) {
  if (!isVaccinationPassEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}

function entryToJson(row) {
  return {
    id: row.id,
    vaccineName: row.vaccineName,
    disease: row.disease,
    vaccinationDate: row.vaccinationDate,
    doseLabel: row.doseLabel,
    lotNumber: row.lotNumber,
    location: row.location,
    nextDueDate: row.nextDueDate,
    notes: row.notes,
    hasDocument: Boolean(row.documentKey),
    documentName: row.documentName,
    documentMime: row.documentMime,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * GET /api/practice/patients/:linkId/vaccinations?practiceId=<id>
 */
router.get("/", requireFeature, async (req, res) => {
  const { linkId } = req.params;
  const practiceId = req.query.practiceId || "";
  const actorUserId = req.user?.userId;

  if (!practiceId || !actorUserId) {
    return res.status(400).json({ ok: false, error: "missing_practice_id" });
  }

  let link;
  try {
    link = await resolvePatientLinkForPractice(linkId, practiceId);
  } catch (err) {
    if (err?.message === "link_not_found") {
      return res.status(404).json({ ok: false, error: "link_not_found" });
    }
    return res.status(400).json({ ok: false, error: "invalid_request" });
  }

  if (!LINK_ACTIVE.has(link.status)) {
    return res.status(403).json({ ok: false, error: "link_inactive" });
  }

  try {
    await assertConsentForLink(link, "vaccinations_access", {
      req,
      actorUserId,
      actorRole: "practice",
    });
  } catch {
    return res.status(403).json({ ok: false, error: "consent_required" });
  }

  try {
    const entries = await prisma.vaccinationEntry.findMany({
      where: { userId: link.patientUserId, deletedAt: null },
      orderBy: { vaccinationDate: "desc" },
    });

    await writeAuditLog({
      userId: actorUserId,
      action: "practice_vaccinations_viewed",
      meta: {
        linkId,
        patientUserId: link.patientUserId,
        count: entries.length,
      },
    }).catch(() => {});

    return res.json({ ok: true, entries: entries.map(entryToJson) });
  } catch (err) {
    console.error("[practiceVaccinations] GET error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
