/**
 * Patient inbox INSIDE one care relationship —
 * /api/patient/practice/:linkId/inbox
 *
 * Distinct from routes/patientInbox.js, the cross-practice list
 * (`/api/patient/inbox`). Same table; only the scope differs.
 *
 * WHAT MAY APPEAR HERE
 * --------------------
 * Notices whose `practicePatientLinkId` is exactly this link and whose patient
 * is this link's patient. `practicePatientLinkId` is nullable, so a notice that
 * belongs to a practice but to no determinable relationship deliberately does
 * NOT appear: attaching it to a relationship it may not belong to would be
 * worse than leaving it in the cross-practice list.
 *
 * AUTHORIZATION
 * -------------
 * Session user + linkId from the path. No practiceId, patientId or itemId is
 * accepted as proof of anything; the scope lives in the database query.
 *
 * READ STATE
 * ----------
 * GET never changes it. Acknowledgement is explicit, through the PATCH
 * endpoints — the cross-practice inbox has always worked that way.
 */

import express from "express";
import { isPatientInboxEnabled } from "../config/featureFlags.js";
import {
  archivePatientLinkInboxItem,
  countPatientLinkInboxUnread,
  listPatientLinkInboxItems,
  markPatientLinkInboxItemRead,
  restorePatientLinkInboxItem,
} from "../services/patientInbox/patientInboxContextService.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router({ mergeParams: true });

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isPatientInboxEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required") return { status: 400, error: msg };
  // A foreign link, a foreign item and a missing one are all "not found".
  if (msg === "link_not_found" || msg === "item_not_found") {
    return { status: 404, error: "not_found" };
  }
  if (msg === "item_archived" || msg === "item_not_archived") {
    return { status: 409, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/** GET / — notices of this care relationship */
router.get("/", requireFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await listPatientLinkInboxItems(req.params.linkId, userId, {
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    logServerError("patient/practice/inbox/list", err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** GET /count — unread notices of this relationship. A number, never content. */
router.get("/count", requireFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const unreadCount = await countPatientLinkInboxUnread(req.params.linkId, userId);
    return res.json({ ok: true, unreadCount });
  } catch (err) {
    logServerError("patient/practice/inbox/count", err);
    const m = mapError(err);
    return res.status(m.status).json({ ok: false, error: m.error });
  }
});

/** Shared handler for the three status transitions. */
function transitionRoute(apply, label) {
  return async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    try {
      const item = await apply(req.params.linkId, req.params.itemId, userId, { req });
      return res.json({ ok: true, item });
    } catch (err) {
      logServerError(`patient/practice/inbox/${label}`, err);
      const m = mapError(err);
      return res.status(m.status).json({ ok: false, error: m.error });
    }
  };
}

router.patch("/:itemId/read", requireFeature, transitionRoute(markPatientLinkInboxItemRead, "read"));
router.patch("/:itemId/archive", requireFeature, transitionRoute(archivePatientLinkInboxItem, "archive"));
router.patch("/:itemId/restore", requireFeature, transitionRoute(restorePatientLinkInboxItem, "restore"));

export default router;
