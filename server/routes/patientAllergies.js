/**
 * Patient allergy entries — /api/patient/allergies
 * Self-reported structured entries. Not an official medical record.
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isHealthHistoryEnabled } from "../config/featureFlags.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

const VALID_TYPES = ["medication", "food", "environmental", "insect", "contact", "other"];
const VALID_SEVERITIES = ["mild", "moderate", "severe", "life_threatening"];
const VALID_STATUSES = ["active", "inactive", "uncertain"];

function uid(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isHealthHistoryEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

function validate(body) {
  const { allergen, allergyType, severity, status } = body;
  if (!allergen?.trim() || allergen.trim().length > 200) return "invalid_allergen";
  if (!VALID_TYPES.includes(allergyType)) return "invalid_type";
  if (!VALID_SEVERITIES.includes(severity)) return "invalid_severity";
  if (status && !VALID_STATUSES.includes(status)) return "invalid_status";
  if (body.diagnosedDate && isNaN(Date.parse(body.diagnosedDate))) return "invalid_date";
  return null;
}

function toJson(row) {
  return {
    id: row.id,
    allergen: row.allergen,
    allergyType: row.allergyType,
    severity: row.severity,
    reaction: row.reaction,
    diagnosedDate: row.diagnosedDate,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** GET /api/patient/allergies */
router.get("/", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const entries = await prisma.allergyEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ severity: "asc" }, { allergen: "asc" }],
    });
    return res.json({ ok: true, entries: entries.map(toJson) });
  } catch (err) {
    console.error("[allergies] GET", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST /api/patient/allergies */
router.post("/", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const err = validate(req.body || {});
  if (err) return res.status(400).json({ ok: false, error: err });

  const { allergen, allergyType, severity, reaction, diagnosedDate, status, notes } = req.body;
  try {
    const entry = await prisma.allergyEntry.create({
      data: {
        userId,
        allergen: allergen.trim().slice(0, 200),
        allergyType,
        severity,
        reaction: reaction?.trim().slice(0, 2000) || null,
        diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : null,
        status: status || "active",
        notes: notes?.trim().slice(0, 2000) || null,
      },
    });
    await writeAuditLog({ userId, action: "allergy_create", meta: { entryId: entry.id, allergen: entry.allergen } }).catch(() => {});
    return res.status(201).json({ ok: true, entry: toJson(entry) });
  } catch (err) {
    console.error("[allergies] POST", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** PATCH /api/patient/allergies/:id */
router.patch("/:id", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.allergyEntry.findFirst({ where: { id: req.params.id, userId, deletedAt: null } }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  const err = validate(req.body || {});
  if (err) return res.status(400).json({ ok: false, error: err });

  const { allergen, allergyType, severity, reaction, diagnosedDate, status, notes } = req.body;
  try {
    const updated = await prisma.allergyEntry.update({
      where: { id: existing.id },
      data: {
        allergen: allergen.trim().slice(0, 200),
        allergyType,
        severity,
        reaction: reaction?.trim().slice(0, 2000) || null,
        diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : null,
        status: status || existing.status,
        notes: notes?.trim().slice(0, 2000) || null,
      },
    });
    await writeAuditLog({ userId, action: "allergy_update", meta: { entryId: updated.id } }).catch(() => {});
    return res.json({ ok: true, entry: toJson(updated) });
  } catch (err) {
    console.error("[allergies] PATCH", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** DELETE /api/patient/allergies/:id */
router.delete("/:id", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.allergyEntry.findFirst({ where: { id: req.params.id, userId, deletedAt: null } }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  try {
    await prisma.allergyEntry.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await writeAuditLog({ userId, action: "allergy_delete", meta: { entryId: existing.id } }).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    console.error("[allergies] DELETE", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
