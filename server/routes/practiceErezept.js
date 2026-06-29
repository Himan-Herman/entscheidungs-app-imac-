/**
 * Practice e-Rezept management — /api/practice/patients/:linkId/erezept
 *
 * GET  /    — list all prescriptions for this patient link
 * POST /    — issue a new prescription
 * PATCH /:id — update status (cancelled) or fields before redemption
 * DELETE /:id — soft-delete
 *
 * Requires: active PracticePatientLink + patient consent "prescriptions_access"
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isErezeptEnabled } from "../config/featureFlags.js";
import { resolvePatientLinkForPractice } from "../services/careRelationship/resolvePatientLink.js";
import { assertConsentForLink } from "../services/consent/consentRecordService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router({ mergeParams: true });

const LINK_ACTIVE = new Set(["invited", "active"]);
const VALID_STATUSES = ["issued", "at_pharmacy", "redeemed", "expired", "cancelled"];
const DEFAULT_VALIDITY_DAYS = 28;

function requireFeature(_req, res, next) {
  if (!isErezeptEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

/** Generates a human-readable simulated token: ERZ-XXXX-XXXX-XXXX */
function generateToken() {
  const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ERZ-${seg()}-${seg()}-${seg()}`;
}

async function resolveLink(req, res) {
  const { linkId } = req.params;
  const practiceId = req.query.practiceId || req.body?.practiceId || "";
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
  try {
    await assertConsentForLink(link, "prescriptions_access", { req, actorUserId, actorRole: "practice" });
  } catch {
    res.status(403).json({ ok: false, error: "consent_required" });
    return null;
  }
  return { link, actorUserId };
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

/** GET /api/practice/patients/:linkId/erezept */
router.get("/", requireFeature, async (req, res) => {
  const ctx = await resolveLink(req, res);
  if (!ctx) return;
  const { link } = ctx;
  try {
    const entries = await prisma.erezeptEntry.findMany({
      where: { patientUserId: link.patientUserId, linkId: link.id, deletedAt: null },
      orderBy: { issuedAt: "desc" },
    });
    return res.json({ ok: true, entries: entries.map(toJson) });
  } catch (err) {
    logServerError("practiceErezept/GET", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST /api/practice/patients/:linkId/erezept */
router.post("/", requireFeature, async (req, res) => {
  const ctx = await resolveLink(req, res);
  if (!ctx) return;
  const { link, actorUserId } = ctx;

  const { medicationName, icdCode, dosage, instructions, notes, validityDays } = req.body || {};
  if (!medicationName?.trim() || medicationName.trim().length > 300) {
    return res.status(400).json({ ok: false, error: "invalid_medication" });
  }

  const days = Math.min(Math.max(parseInt(validityDays) || DEFAULT_VALIDITY_DAYS, 1), 90);
  const validUntil = new Date(Date.now() + days * 86_400_000);
  const tokenCode = generateToken();

  try {
    const entry = await prisma.erezeptEntry.create({
      data: {
        patientUserId: link.patientUserId,
        issuedByUserId: actorUserId,
        linkId: link.id,
        medicationName: medicationName.trim().slice(0, 300),
        icdCode: icdCode?.trim().slice(0, 20) || null,
        dosage: dosage?.trim().slice(0, 200) || null,
        instructions: instructions?.trim().slice(0, 2000) || null,
        tokenCode,
        status: "issued",
        validUntil,
        notes: notes?.trim().slice(0, 2000) || null,
      },
    });
    await writeAuditLog({
      userId: actorUserId,
      action: "erezept_issued",
      meta: { entryId: entry.id, linkId: link.id, patientUserId: link.patientUserId },
    }).catch(() => {});
    return res.status(201).json({ ok: true, entry: toJson(entry) });
  } catch (err) {
    logServerError("practiceErezept/POST", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** PATCH /api/practice/patients/:linkId/erezept/:id — cancel or update */
router.patch("/:id", requireFeature, async (req, res) => {
  const ctx = await resolveLink(req, res);
  if (!ctx) return;
  const { link, actorUserId } = ctx;

  const existing = await prisma.erezeptEntry.findFirst({
    where: { id: req.params.id, linkId: link.id, deletedAt: null },
  }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  const { status, notes } = req.body || {};
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: "invalid_status" });
  }

  try {
    const updated = await prisma.erezeptEntry.update({
      where: { id: existing.id },
      data: {
        status: status || existing.status,
        notes: notes !== undefined ? (notes?.trim().slice(0, 2000) || null) : existing.notes,
        redeemedAt: status === "redeemed" && !existing.redeemedAt ? new Date() : existing.redeemedAt,
      },
    });
    await writeAuditLog({
      userId: actorUserId,
      action: "erezept_updated",
      meta: { entryId: updated.id, status: updated.status },
    }).catch(() => {});
    return res.json({ ok: true, entry: toJson(updated) });
  } catch (err) {
    logServerError("practiceErezept/PATCH", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** DELETE /api/practice/patients/:linkId/erezept/:id */
router.delete("/:id", requireFeature, async (req, res) => {
  const ctx = await resolveLink(req, res);
  if (!ctx) return;
  const { link, actorUserId } = ctx;

  const existing = await prisma.erezeptEntry.findFirst({
    where: { id: req.params.id, linkId: link.id, deletedAt: null },
  }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  try {
    await prisma.erezeptEntry.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await writeAuditLog({
      userId: actorUserId,
      action: "erezept_deleted",
      meta: { entryId: existing.id },
    }).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    logServerError("practiceErezept/DELETE", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
