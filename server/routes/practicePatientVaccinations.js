/**
 * Practice read-only view of a patient's shared vaccination entries.
 * GET /api/practice/patients/:linkId/vaccinations
 *
 * Requires:
 *  - Practice authentication (requireAuth applied in app.js)
 *  - Active PracticePatientLink between practice and patient
 *  - Patient consent scope "vaccinations" (consent type "vaccinations_access")
 */

import {
  isStoredVaccinationKey,
  vaccinationDocumentStorage,
} from "../services/vaccination/vaccinationDocumentStorage.js";
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
    // Same rule as the patient side, and for the same reason: a practice must
    // not be told a certificate is on file when nothing was ever stored.
    hasDocument: isStoredVaccinationKey(row.documentKey),
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

/**
 * GET /api/practice/patients/:linkId/vaccinations/:id/document
 *
 * The practice side of the same document, on exactly the same terms as the
 * list it appears in: the same permission, the same consent, and — the part
 * that matters — the same `where`.
 *
 * Reusing `buildPatientDataContextReadWhere` rather than looking the entry up
 * by id and checking afterwards is deliberate. A post-hoc check is a second
 * place to be wrong; a shared `where` means a certificate recorded inside
 * another care relationship is not found at all, and the boundary here cannot
 * drift away from the boundary on the list.
 */
router.get(
  "/:id/document",
  requireFeature,
  requirePracticePatientLinkAccess({
    permission: PERMISSIONS.CLINICAL_VACCINATIONS_READ,
    consentType: "vaccinations_access",
  }),
  async (req, res) => {
    const { link, actorUserId } = req.linkAccess;

    try {
      const entry = await prisma.vaccinationEntry.findFirst({
        where: {
          id: req.params.id,
          ...buildPatientDataContextReadWhere({
            patientUserId: link.patientUserId,
            practicePatientLinkId: link.id,
          }),
        },
      });
      if (!entry || !isStoredVaccinationKey(entry.documentKey)) {
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      const buffer = await vaccinationDocumentStorage.getDocument(entry.documentKey);

      writeAuditLog({
        req,
        userId: actorUserId,
        actorRole: "practice",
        action: "practice_vaccination_document_downloaded",
        entityType: "vaccination_entry",
        entityId: entry.id,
        metadata: { linkId: link.id },
      });

      const filename = String(entry.documentName || "impfnachweis").slice(0, 200);
      res.setHeader("Content-Type", entry.documentMime || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(filename)}"`,
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-store, private");
      return res.send(buffer);
    } catch (err) {
      console.error("[practice/vaccinations/document]", err?.message ?? err);
      return res.status(404).json({ ok: false, error: "not_found" });
    }
  },
);

export default router;
