/**
 * Patient e-prescriptions INSIDE one care relationship —
 * /api/patient/practice/:linkId/erezept
 *
 * Distinct from routes/patientErezept.js, the older cross-practice list
 * (`/api/patient/erezept`). Both read the same table; only the scope differs.
 *
 * The name follows the product's own vocabulary: the model, the routes, the
 * client feature folder and the i18n namespace all say "erezept", so no second
 * term ("prescriptions") is introduced here.
 *
 * WHAT MAY APPEAR HERE
 * --------------------
 * Entries whose `linkId` is exactly this link's id AND whose `patientUserId` is
 * this link's patient. Not an entry of another practice, not one of another
 * link to the SAME practice, and not one that merely belongs to the same
 * account. `ErezeptEntry.linkId` carries no foreign key, so a value naming
 * nothing simply matches nothing — it is never interpreted as anything else.
 *
 * AUTHORIZATION
 * -------------
 * Session user + linkId from the path. No practiceId, patientId or entryId is
 * accepted as proof of anything; the scope lives in the database query.
 *
 * NOT HERE
 * --------
 * Issuing and cancelling belong to the practice side
 * (/api/practice/patients/:linkId/erezept), where they are gated by
 * PRESCRIPTION_* permissions that no role currently holds. Nothing on this
 * route creates, cancels or deletes a prescription.
 */

import express from "express";
import { isErezeptEnabled } from "../config/featureFlags.js";
import {
  listPatientLinkErezept,
  updatePatientLinkErezeptStatus,
} from "../services/erezept/patientErezeptContextService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router({ mergeParams: true });

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isErezeptEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required" || msg === "invalid_status") {
    return { status: 400, error: msg };
  }
  // A foreign link, a foreign entry and a missing one are all "not found".
  if (msg === "link_not_found" || msg === "entry_not_found") {
    return { status: 404, error: "not_found" };
  }
  if (msg === "already_final") return { status: 409, error: msg };
  return { status: 500, error: "request_failed" };
}

/** GET / — prescriptions of this care relationship */
router.get("/", requireFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const entries = await listPatientLinkErezept(req.params.linkId, userId);
    return res.json({ ok: true, entries });
  } catch (err) {
    logServerError("patient/practice/erezept/GET", err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/**
 * PATCH /:id — the patient marks a prescription at_pharmacy or redeemed.
 *
 * The same right the cross-practice page already grants; only the scope is
 * narrower. Best-effort audit, matching the existing patient-side status
 * change: issuing and cancelling are the acts that carry a mandatory trail,
 * and they live on the practice route.
 */
router.patch("/:id", requireFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { link, json } = await updatePatientLinkErezeptStatus(
      req.params.linkId,
      req.params.id,
      userId,
      req.body?.status,
    );

    writeAuditLog({
      req,
      userId,
      actorRole: "patient",
      action: "erezept_status_updated",
      entityType: "erezept_entry",
      entityId: json.id,
      practicePatientLinkId: link.id,
      metadata: { entryId: json.id, status: json.status },
    });

    return res.json({ ok: true, entry: json });
  } catch (err) {
    logServerError("patient/practice/erezept/PATCH", err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

export default router;
