/**
 * Practice read-only view of a patient's shared vital entries.
 * GET /api/practice/patients/:linkId/vitals
 *
 * Requires:
 *  - Practice authentication (requireAuth applied in app.js)
 *  - Active PracticePatientLink between practice and patient
 *  - Patient consent scope "vitals" (consent type "vitals_access")
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isVitalsEnabled } from "../config/featureFlags.js";
import { requirePracticePatientLinkAccess } from "../services/authorization/practicePatientLinkAuthorization.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router({ mergeParams: true });

const VALID_TYPES = ["blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature"];

function requireFeature(_req, res, next) {
  if (!isVitalsEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

function entryToJson(row) {
  return {
    id: row.id,
    type: row.type,
    valuePrimary: row.valuePrimary,
    valueSecondary: row.valueSecondary,
    unit: row.unit,
    measuredAt: row.measuredAt,
    notes: row.notes,
    source: row.source,
    createdAt: row.createdAt,
  };
}

/**
 * GET /api/practice/patients/:linkId/vitals
 * Query: ?type=blood_pressure&limit=200&practiceId=<id>
 */
router.get("/", requireFeature, requirePracticePatientLinkAccess({
  permission: PERMISSIONS.CLINICAL_VITALS_READ,
  consentType: "vitals_access",
}), async (req, res) => {
  const { link, actorUserId } = req.linkAccess;
  const { linkId } = req.params;

  const { type, limit: rawLimit } = req.query;
  const where = { userId: link.patientUserId, deletedAt: null };
  if (type && VALID_TYPES.includes(type)) where.type = type;
  const limit = Math.min(500, Math.max(1, parseInt(rawLimit, 10) || 200));

  try {
    const entries = await prisma.vitalEntry.findMany({
      where,
      orderBy: { measuredAt: "desc" },
      take: limit,
    });

    writeAuditLog({
      userId: actorUserId,
      action: "practice_vitals_viewed",
      metadata: { linkId, patientUserId: link.patientUserId, count: entries.length },
    });

    return res.json({ ok: true, entries: entries.map(entryToJson) });
  } catch (err) {
    console.error("[practiceVitals] GET error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
