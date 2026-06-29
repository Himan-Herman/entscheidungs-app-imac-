/**
 * Patient diagnosis / medical history entries — /api/patient/diagnoses
 * Self-reported structured entries. Not an official medical record.
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isHealthHistoryEnabled } from "../config/featureFlags.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

const VALID_STATUSES = ["active", "chronic", "resolved", "managed", "uncertain"];

function uid(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isHealthHistoryEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

function validate(body) {
  const { conditionName, status } = body;
  if (!conditionName?.trim() || conditionName.trim().length > 300) return "invalid_condition";
  if (status && !VALID_STATUSES.includes(status)) return "invalid_status";
  if (body.diagnosedDate && isNaN(Date.parse(body.diagnosedDate))) return "invalid_date";
  if (body.icdCode && body.icdCode.trim().length > 20) return "invalid_icd_code";
  return null;
}

function toJson(row) {
  return {
    id: row.id,
    conditionName: row.conditionName,
    icdCode: row.icdCode,
    diagnosedDate: row.diagnosedDate,
    status: row.status,
    treatingDoctor: row.treatingDoctor,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** GET /api/patient/diagnoses */
router.get("/", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const entries = await prisma.diagnosisEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ status: "asc" }, { conditionName: "asc" }],
    });
    return res.json({ ok: true, entries: entries.map(toJson) });
  } catch (err) {
    console.error("[diagnoses] GET", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST /api/patient/diagnoses */
router.post("/", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const err = validate(req.body || {});
  if (err) return res.status(400).json({ ok: false, error: err });

  const { conditionName, icdCode, diagnosedDate, status, treatingDoctor, notes } = req.body;
  try {
    const entry = await prisma.diagnosisEntry.create({
      data: {
        userId,
        conditionName: conditionName.trim().slice(0, 300),
        icdCode: icdCode?.trim().slice(0, 20) || null,
        diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : null,
        status: status || "active",
        treatingDoctor: treatingDoctor?.trim().slice(0, 200) || null,
        notes: notes?.trim().slice(0, 2000) || null,
      },
    });
    await writeAuditLog({ userId, action: "diagnosis_create", meta: { entryId: entry.id } }).catch(() => {});
    return res.status(201).json({ ok: true, entry: toJson(entry) });
  } catch (err) {
    console.error("[diagnoses] POST", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** PATCH /api/patient/diagnoses/:id */
router.patch("/:id", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.diagnosisEntry.findFirst({ where: { id: req.params.id, userId, deletedAt: null } }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  const err = validate(req.body || {});
  if (err) return res.status(400).json({ ok: false, error: err });

  const { conditionName, icdCode, diagnosedDate, status, treatingDoctor, notes } = req.body;
  try {
    const updated = await prisma.diagnosisEntry.update({
      where: { id: existing.id },
      data: {
        conditionName: conditionName.trim().slice(0, 300),
        icdCode: icdCode?.trim().slice(0, 20) || null,
        diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : null,
        status: status || existing.status,
        treatingDoctor: treatingDoctor?.trim().slice(0, 200) || null,
        notes: notes?.trim().slice(0, 2000) || null,
      },
    });
    await writeAuditLog({ userId, action: "diagnosis_update", meta: { entryId: updated.id } }).catch(() => {});
    return res.json({ ok: true, entry: toJson(updated) });
  } catch (err) {
    console.error("[diagnoses] PATCH", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** DELETE /api/patient/diagnoses/:id */
router.delete("/:id", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.diagnosisEntry.findFirst({ where: { id: req.params.id, userId, deletedAt: null } }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  try {
    await prisma.diagnosisEntry.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await writeAuditLog({ userId, action: "diagnosis_delete", meta: { entryId: existing.id } }).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    console.error("[diagnoses] DELETE", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
