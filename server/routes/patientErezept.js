/**
 * Patient e-Rezept — /api/patient/erezept
 *
 * GET  /        — list all prescriptions across connected practices
 * PATCH /:id    — patient updates status (at_pharmacy | redeemed)
 *
 * Patient can only update status of their own entries.
 * Read-only for other fields — practice is the issuer.
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isErezeptEnabled } from "../config/featureFlags.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router();

const PATIENT_ALLOWED_STATUSES = new Set(["at_pharmacy", "redeemed"]);

function uid(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isErezeptEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

function toJson(r) {
  return {
    id: r.id,
    medicationName: r.medicationName,
    icdCode: r.icdCode,
    dosage: r.dosage,
    instructions: r.instructions,
    tokenCode: r.tokenCode,
    status: r.status,
    issuedAt: r.issuedAt,
    validUntil: r.validUntil,
    redeemedAt: r.redeemedAt,
    notes: r.notes,
    createdAt: r.createdAt,
  };
}

/** GET /api/patient/erezept */
router.get("/", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const entries = await prisma.erezeptEntry.findMany({
      where: { patientUserId: userId, deletedAt: null },
      orderBy: { issuedAt: "desc" },
    });

    // Auto-expire any that have passed validUntil and are still "issued"
    const now = new Date();
    const toExpire = entries
      .filter((e) => e.status === "issued" && new Date(e.validUntil) < now)
      .map((e) => e.id);
    if (toExpire.length > 0) {
      await prisma.erezeptEntry.updateMany({
        where: { id: { in: toExpire } },
        data: { status: "expired" },
      }).catch(() => {});
    }

    const fresh = await prisma.erezeptEntry.findMany({
      where: { patientUserId: userId, deletedAt: null },
      orderBy: { issuedAt: "desc" },
    });

    return res.json({ ok: true, entries: fresh.map(toJson) });
  } catch (err) {
    logServerError("patientErezept/GET", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** PATCH /api/patient/erezept/:id — patient marks at_pharmacy or redeemed */
router.patch("/:id", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.erezeptEntry.findFirst({
    where: { id: req.params.id, patientUserId: userId, deletedAt: null },
  }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  const { status } = req.body || {};
  if (!status || !PATIENT_ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ ok: false, error: "invalid_status" });
  }

  if (["redeemed", "expired", "cancelled"].includes(existing.status)) {
    return res.status(409).json({ ok: false, error: "already_final" });
  }

  try {
    const updated = await prisma.erezeptEntry.update({
      where: { id: existing.id },
      data: {
        status,
        redeemedAt: status === "redeemed" ? new Date() : existing.redeemedAt,
      },
    });
    await writeAuditLog({
      userId,
      action: "erezept_status_updated",
      meta: { entryId: updated.id, status },
    }).catch(() => {});
    return res.json({ ok: true, entry: toJson(updated) });
  } catch (err) {
    logServerError("patientErezept/PATCH", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
