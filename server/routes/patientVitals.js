/**
 * Patient vital measurements — /api/patient/vitals
 * Self-reported manual entries. Not an official medical record.
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isVitalsEnabled } from "../config/featureFlags.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { VALID_TYPES, DEFAULT_UNITS, validateVital } from "../services/vitals/vitalConstants.js";

const router = express.Router();

function userId(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isVitalsEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

const validateEntry = validateVital;

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
    sourceProvider: row.sourceProvider ?? null,
    sourceDevice: row.sourceDevice ?? null,
    createdAt: row.createdAt,
  };
}

/** GET /api/patient/vitals?type=blood_pressure&limit=100 */
router.get("/", requireFeature, async (req, res) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { type, limit: rawLimit } = req.query;
  const where = { userId: uid, deletedAt: null };
  if (type && VALID_TYPES.includes(type)) where.type = type;

  const limit = Math.min(500, Math.max(1, parseInt(rawLimit, 10) || 200));

  try {
    const entries = await prisma.vitalEntry.findMany({
      where,
      orderBy: { measuredAt: "desc" },
      take: limit,
    });
    return res.json({ ok: true, entries: entries.map(entryToJson) });
  } catch (err) {
    console.error("[vitals] GET error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST /api/patient/vitals */
router.post("/", requireFeature, async (req, res) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { type, valuePrimary, valueSecondary, unit, measuredAt, notes } = req.body || {};
  const err = validateEntry(req.body || {});
  if (err) return res.status(400).json({ ok: false, error: err });

  try {
    const entry = await prisma.vitalEntry.create({
      data: {
        userId: uid,
        type,
        valuePrimary: Number(valuePrimary),
        valueSecondary: type === "blood_pressure" ? Number(valueSecondary) : null,
        unit: (unit || DEFAULT_UNITS[type] || "").trim(),
        measuredAt: new Date(measuredAt),
        notes: notes?.trim() || null,
        source: "manual",
      },
    });
    writeAuditLog({ userId: uid, action: "vitals_create", meta: { type, entryId: entry.id } });
    return res.status(201).json({ ok: true, entry: entryToJson(entry) });
  } catch (err) {
    console.error("[vitals] POST error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** PATCH /api/patient/vitals/:id */
router.patch("/:id", requireFeature, async (req, res) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.vitalEntry.findFirst({
    where: { id: req.params.id, userId: uid, deletedAt: null },
  }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  const body = { ...req.body, type: existing.type };
  const err = validateEntry(body);
  if (err) return res.status(400).json({ ok: false, error: err });

  try {
    const updated = await prisma.vitalEntry.update({
      where: { id: req.params.id },
      data: {
        valuePrimary: Number(body.valuePrimary),
        valueSecondary: existing.type === "blood_pressure" ? Number(body.valueSecondary) : null,
        unit: (body.unit || existing.unit).trim(),
        measuredAt: new Date(body.measuredAt),
        notes: body.notes?.trim() || null,
      },
    });
    writeAuditLog({ userId: uid, action: "vitals_update", meta: { entryId: req.params.id } });
    return res.json({ ok: true, entry: entryToJson(updated) });
  } catch (err) {
    console.error("[vitals] PATCH error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** DELETE /api/patient/vitals/:id */
router.delete("/:id", requireFeature, async (req, res) => {
  const uid = userId(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.vitalEntry.findFirst({
    where: { id: req.params.id, userId: uid, deletedAt: null },
  }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  try {
    await prisma.vitalEntry.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    writeAuditLog({ userId: uid, action: "vitals_delete", meta: { entryId: req.params.id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[vitals] DELETE error", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
