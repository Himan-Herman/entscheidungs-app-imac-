/**
 * Patient inbox (PR-4) — neutral practice notifications.
 * Routes mounted at /api/patient/inbox
 * Requires PATIENT_INBOX=true.
 */

import express from "express";
import { requirePatientInboxFeature } from "../middleware/requirePatientInbox.js";
import {
  archiveInboxItem,
  listInboxItemsForPatient,
  markInboxItemRead,
  INBOX_STATUSES,
} from "../services/patientInbox/patientInboxService.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

router.use(requirePatientInboxFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required" || msg === "validation_invalid_type") {
    return { status: 400, error: msg };
  }
  if (msg === "validation_text_too_long") {
    return { status: 400, error: msg };
  }
  if (msg === "item_not_found" || msg === "link_not_found" || msg === "practice_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "item_archived") {
    return { status: 409, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/** GET /api/patient/inbox?status=&limit=&offset= */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const status = String(req.query.status || "").trim();
  if (status && !INBOX_STATUSES.has(status)) {
    return res.status(400).json({ ok: false, error: "validation_invalid_status" });
  }

  try {
    const result = await listInboxItemsForPatient(userId, {
      status: status || undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/inbox/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/patient/inbox/:itemId/read */
router.patch("/:itemId/read", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const item = await markInboxItemRead(req.params.itemId, userId);

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_inbox_item_read",
      entityType: "PatientInboxItem",
      entityId: item.id,
      metadata: { type: item.type },
    });

    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[patient/inbox/read]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/patient/inbox/:itemId/archive */
router.patch("/:itemId/archive", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const item = await archiveInboxItem(req.params.itemId, userId);

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_inbox_item_archived",
      entityType: "PatientInboxItem",
      entityId: item.id,
      metadata: { type: item.type },
    });

    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[patient/inbox/archive]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
