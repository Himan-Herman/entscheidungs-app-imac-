/**
 * Patient symptom diary entries — /api/patient/symptoms
 *
 * Self-reported, chronological documentation only. NOT an official medical record.
 * No diagnosis, no therapy, no triage, no urgency, no medical interpretation, no AI.
 * userId-scoped; never mixes with practice data. Invoice/symptom content is never logged.
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isSymptomDiaryEnabled } from "../config/featureFlags.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

// Field length caps (mirror the schema VarChar limits).
const CAPS = {
  symptom: 200,
  durationText: 120,
  bodyRegion: 120,
  trigger: 300,
  betterWith: 300,
  worseWith: 300,
  measuresText: 300,
  notes: 2000,
};

function uid(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isSymptomDiaryEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

/** Returns an error code string, or null when valid. */
function validate(body) {
  const { symptom, severity, occurredAt } = body || {};
  if (!symptom || !String(symptom).trim()) return "invalid_symptom";
  if (String(symptom).trim().length > CAPS.symptom) return "symptom_too_long";

  const sev = Number(severity);
  if (!Number.isInteger(sev) || sev < 0 || sev > 10) return "invalid_severity";

  if (!occurredAt || isNaN(Date.parse(occurredAt))) return "invalid_occurredAt";

  // Optional text fields — reject over-long input rather than silently truncating.
  for (const key of ["durationText", "bodyRegion", "trigger", "betterWith", "worseWith", "measuresText", "notes"]) {
    const v = body?.[key];
    if (v != null && String(v).length > CAPS[key]) return "text_too_long";
  }
  return null;
}

/** Map a DB row to the API shape. */
function toJson(row) {
  return {
    id: row.id,
    symptom: row.symptom,
    severity: row.severity,
    occurredAt: row.occurredAt,
    durationText: row.durationText,
    bodyRegion: row.bodyRegion,
    trigger: row.trigger,
    betterWith: row.betterWith,
    worseWith: row.worseWith,
    measuresText: row.measuresText,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Build create/update data from a validated body. */
function toData(body) {
  const trimCap = (v, cap) => {
    const s = v != null ? String(v).trim() : "";
    return s ? s.slice(0, cap) : null;
  };
  return {
    symptom: String(body.symptom).trim().slice(0, CAPS.symptom),
    severity: Number(body.severity),
    occurredAt: new Date(body.occurredAt),
    durationText: trimCap(body.durationText, CAPS.durationText),
    bodyRegion: trimCap(body.bodyRegion, CAPS.bodyRegion),
    trigger: trimCap(body.trigger, CAPS.trigger),
    betterWith: trimCap(body.betterWith, CAPS.betterWith),
    worseWith: trimCap(body.worseWith, CAPS.worseWith),
    measuresText: trimCap(body.measuresText, CAPS.measuresText),
    notes: trimCap(body.notes, CAPS.notes),
  };
}

/** GET /api/patient/symptoms — newest first. */
router.get("/", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const entries = await prisma.symptomEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    });
    return res.json({ ok: true, entries: entries.map(toJson) });
  } catch (err) {
    console.error("[symptoms] GET", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST /api/patient/symptoms */
router.post("/", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const err = validate(req.body || {});
  if (err) return res.status(400).json({ ok: false, error: err });

  try {
    const entry = await prisma.symptomEntry.create({ data: { userId, ...toData(req.body) } });
    // Audit metadata only — never the symptom content.
    await writeAuditLog({ userId, action: "symptom_create", meta: { entryId: entry.id } }).catch(() => {});
    return res.status(201).json({ ok: true, entry: toJson(entry) });
  } catch (err) {
    console.error("[symptoms] POST", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** PATCH /api/patient/symptoms/:id */
router.patch("/:id", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.symptomEntry
    .findFirst({ where: { id: req.params.id, userId, deletedAt: null } })
    .catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  const err = validate(req.body || {});
  if (err) return res.status(400).json({ ok: false, error: err });

  try {
    const updated = await prisma.symptomEntry.update({ where: { id: existing.id }, data: toData(req.body) });
    await writeAuditLog({ userId, action: "symptom_update", meta: { entryId: updated.id } }).catch(() => {});
    return res.json({ ok: true, entry: toJson(updated) });
  } catch (err) {
    console.error("[symptoms] PATCH", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** DELETE /api/patient/symptoms/:id — soft-delete via deletedAt. */
router.delete("/:id", requireFeature, async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const existing = await prisma.symptomEntry
    .findFirst({ where: { id: req.params.id, userId, deletedAt: null } })
    .catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  try {
    await prisma.symptomEntry.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await writeAuditLog({ userId, action: "symptom_delete", meta: { entryId: existing.id } }).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    console.error("[symptoms] DELETE", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
