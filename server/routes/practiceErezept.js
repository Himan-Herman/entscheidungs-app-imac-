/**
 * Practice e-Rezept management — /api/practice/patients/:linkId/erezept
 *
 * GET  /     — list all prescriptions for this patient link
 * POST /     — issue a new prescription
 * PATCH /:id — cancel a live prescription (cancel-only state machine)
 * DELETE /:id — cancel as well; never removes the record
 *
 * Requires: active PracticePatientLink + patient consent "prescriptions_access"
 * plus the caller's practice membership and permission, enforced centrally.
 *
 * NOTE: all three PRESCRIPTION_* permissions are currently granted to no role,
 * so every endpoint here denies by default until a verified professional
 * qualification exists in the data model. See practicePermissions.js.
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import { isErezeptEnabled } from "../config/featureFlags.js";
import { requirePracticePatientLinkAccess } from "../services/authorization/practicePatientLinkAuthorization.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import { writeRequiredAuditLog } from "../services/auditLogService.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router({ mergeParams: true });

// Persisted status values are issued | at_pharmacy | redeemed | expired |
// cancelled. Only "cancelled" is reachable through this API — see the state
// machine at the PATCH handler.

/**
 * Prescriptions get their own permissions rather than the general medication
 * rights: a medication plan is documentation, a prescription is a regulated
 * medical act. All three are held by no role until a verified professional
 * qualification exists, so these gates deny every caller by design.
 */
const requirePrescriptionRead = requirePracticePatientLinkAccess({
  permission: PERMISSIONS.PRESCRIPTION_READ,
  consentType: "prescriptions_access",
});
const requirePrescriptionIssue = requirePracticePatientLinkAccess({
  permission: PERMISSIONS.PRESCRIPTION_ISSUE,
  consentType: "prescriptions_access",
});
const requirePrescriptionCancel = requirePracticePatientLinkAccess({
  permission: PERMISSIONS.PRESCRIPTION_CANCEL,
  consentType: "prescriptions_access",
});
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
router.get("/", requireFeature, requirePrescriptionRead, async (req, res) => {
  const { link } = req.linkAccess;
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
router.post("/", requireFeature, requirePrescriptionIssue, async (req, res) => {
  const { link, actorUserId } = req.linkAccess;

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
    // Mandatory: issuing a prescription must not be reported as successful if
    // it could not be recorded.
    await writeRequiredAuditLog({
      req,
      userId: actorUserId,
      action: "erezept_issued",
      practicePatientLinkId: link.id,
      patientUserId: link.patientUserId,
      entityType: "erezept_entry",
      entityId: entry.id,
      metadata: { entryId: entry.id },
    });
    return res.status(201).json({ ok: true, entry: toJson(entry) });
  } catch (err) {
    logServerError("practiceErezept/POST", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/**
 * Controlled cancellation, shared by PATCH and DELETE.
 *
 * Both endpoints perform exactly ONE operation: revoke a live prescription.
 * That is what makes PRESCRIPTION_CANCEL the correct gate for them.
 *
 * Previously PATCH accepted any value from VALID_STATUSES with no transition
 * rules, so a prescription could be moved backwards (redeemed -> issued) or
 * silently marked as dispensed. The dispensing states (at_pharmacy, redeemed)
 * belong to a pharmacy/TI system, not to a practice endpoint, and are no longer
 * settable here; reintroducing them requires their own permission and a real
 * integration.
 */
async function cancelPrescription({ req, existing, link, actorUserId, notes, auditAction }) {
  const updated = await prisma.erezeptEntry.update({
    where: { id: existing.id },
    data: {
      status: "cancelled",
      // Never null out an existing note when the caller did not send one.
      notes: notes !== undefined ? notes : existing.notes,
    },
  });
  // Mandatory: a revoked prescription that leaves no audit trail is worse than
  // a failed request, so let a write failure surface as a 500.
  await writeRequiredAuditLog({
    req,
    userId: actorUserId,
    action: auditAction,
    practicePatientLinkId: link.id,
    entityType: "erezept_entry",
    entityId: updated.id,
    metadata: { entryId: updated.id, from: existing.status, to: "cancelled" },
  });
  return updated;
}

/** Only a live prescription can be revoked; the rest are terminal. */
export const CANCELLABLE_FROM = new Set(["issued", "at_pharmacy"]);
/** Exactly one reachable target state via this API. */
const ALLOWED_TARGET_STATUS = "cancelled";
/** Explicit request-body allowlist — anything else is rejected. */
const PATCH_ALLOWED_FIELDS = new Set(["status", "notes"]);

/**
 * Pure validation + state machine for the cancel endpoint, exported so the
 * semantics stay testable independently of the permission gate (which
 * currently denies every caller — see practicePermissions.js).
 *
 * @param {unknown} rawBody
 * @param {string | null} existingStatus null when the record was not found yet
 * @returns {{ ok: true, notes?: string | null } | { ok: false, status: number, error: string }}
 */
export function validatePrescriptionCancel(rawBody, existingStatus) {
  const body = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody) ? rawBody : {};

  const unknown = Object.keys(body).filter((k) => !PATCH_ALLOWED_FIELDS.has(k));
  if (unknown.length > 0) {
    return { ok: false, status: 400, error: "unsupported_field" };
  }

  if (body.status !== undefined && body.status !== ALLOWED_TARGET_STATUS) {
    return { ok: false, status: 400, error: "unsupported_status_transition" };
  }

  let notes;
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return { ok: false, status: 400, error: "invalid_notes" };
    }
    notes = body.notes === null ? null : body.notes.trim().slice(0, 2000) || null;
  }

  if (existingStatus !== null && !CANCELLABLE_FROM.has(existingStatus)) {
    return { ok: false, status: 409, error: "status_transition_not_allowed" };
  }

  return { ok: true, notes };
}

/**
 * PATCH /api/practice/patients/:linkId/erezept/:id
 * Cancel-only. Accepts { status?: "cancelled", notes?: string|null }.
 */
router.patch("/:id", requireFeature, requirePrescriptionCancel, async (req, res) => {
  const { link, actorUserId } = req.linkAccess;

  // 1) Validate the body shape before touching the database.
  const shape = validatePrescriptionCancel(req.body, null);
  if (!shape.ok) return res.status(shape.status).json({ ok: false, error: shape.error });

  const existing = await prisma.erezeptEntry.findFirst({
    where: { id: req.params.id, linkId: link.id, deletedAt: null },
  }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  // 2) State machine: only live prescriptions may be cancelled.
  const transition = validatePrescriptionCancel(req.body, existing.status);
  if (!transition.ok) {
    return res.status(transition.status).json({ ok: false, error: transition.error });
  }
  const notes = transition.notes;

  try {
    const updated = await cancelPrescription({
      req, existing, link, actorUserId, notes,
      auditAction: "erezept_cancelled",
    });
    return res.json({ ok: true, entry: toJson(updated) });
  } catch (err) {
    logServerError("practiceErezept/PATCH", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/**
 * DELETE /api/practice/patients/:linkId/erezept/:id
 *
 * Revokes rather than deletes. The previous implementation set `deletedAt`,
 * which removed a medically relevant record from both the practice and the
 * patient view without leaving a visible trace. The row is now kept and moved
 * to "cancelled" so the history stays auditable for the patient.
 */
router.delete("/:id", requireFeature, requirePrescriptionCancel, async (req, res) => {
  const { link, actorUserId } = req.linkAccess;

  const existing = await prisma.erezeptEntry.findFirst({
    where: { id: req.params.id, linkId: link.id, deletedAt: null },
  }).catch(() => null);
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  if (!CANCELLABLE_FROM.has(existing.status)) {
    return res.status(409).json({ ok: false, error: "status_transition_not_allowed" });
  }

  try {
    const updated = await cancelPrescription({
      req, existing, link, actorUserId, notes: undefined,
      auditAction: "erezept_cancelled",
    });
    return res.json({ ok: true, entry: toJson(updated) });
  } catch (err) {
    logServerError("practiceErezept/DELETE", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
