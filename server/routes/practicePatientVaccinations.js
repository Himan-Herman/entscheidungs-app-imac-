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
import { requirePracticePatientLinkAccess } from "../services/authorization/practicePatientLinkAuthorization.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { buildPatientDataContextReadWhere, practiceProvenanceJson } from "../services/patientData/patientDataContextReadService.js";

const router = express.Router({ mergeParams: true });

function requireFeature(_req, res, next) {
  if (!isVaccinationPassEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}

function entryToJson(row) {
  return {
    // Origin type only — never the link id, never the patient id.
    ...practiceProvenanceJson(row),
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
router.get("/", requireFeature, requirePracticePatientLinkAccess({
  permission: PERMISSIONS.CLINICAL_VACCINATIONS_READ,
  consentType: "vaccinations_access",
}), async (req, res) => {
  const { link, actorUserId } = req.linkAccess;
  const { linkId } = req.params;

  try {
    // Global records plus the ones recorded inside THIS care relationship.
    // Another link's data and unclassified legacy rows never match.
    const entries = await prisma.vaccinationEntry.findMany({
      where: buildPatientDataContextReadWhere({
        patientUserId: link.patientUserId,
        practicePatientLinkId: link.id,
      }),
      orderBy: { vaccinationDate: "desc" },
    });

    writeAuditLog({
      userId: actorUserId,
      action: "practice_vaccinations_viewed",
      metadata: {
        linkId,
        patientUserId: link.patientUserId,
        count: entries.length,
      },
    });

    return res.json({ ok: true, entries: entries.map(entryToJson) });
  } catch (err) {
    console.error("[practiceVaccinations] GET error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
