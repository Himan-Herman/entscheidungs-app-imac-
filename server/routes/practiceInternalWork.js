/**
 * Practice-internal notes and reminders on one care link.
 *   /api/practice/patients/:linkId/internal-notes
 *   /api/practice/patients/:linkId/reminders
 *
 * AUTHORIZATION
 *   `requirePracticePatientLinkAccess()` — the same guard every other
 *   patient-scoped practice route uses. It anchors on the link, derives the
 *   tenant from it, checks active membership, the role permission, the link
 *   status and consent, and answers `link_not_found` for both "missing" and
 *   "not yours". No second membership mechanism is introduced here.
 *
 *   Handlers use `req.linkAccess.linkId` and `.practiceProfileId` — the
 *   server-derived values — never `req.params.linkId`.
 *
 * These endpoints exist only under /api/practice. There is no patient-side
 * counterpart, and no patient route imports the services behind them.
 */

import express from "express";

import { requirePracticePatientLinkAccess } from "../services/authorization/practicePatientLinkAuthorization.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import {
  INTERNAL_WORK_ERRORS,
  InternalWorkError,
} from "../services/practiceInternalWork/internalWorkPolicy.js";
import {
  createInternalNote,
  listInternalNotes,
  updateOwnInternalNote,
} from "../services/practiceInternalWork/internalNoteService.js";
import {
  completeReminder,
  createReminder,
  listReminders,
} from "../services/practiceInternalWork/reminderService.js";

const router = express.Router({ mergeParams: true });

/** @param {string} code */
function statusFor(code) {
  switch (code) {
    case INTERNAL_WORK_ERRORS.NOT_FOUND:
      return 404;
    case INTERNAL_WORK_ERRORS.ASSIGNEE_NOT_IN_PRACTICE:
      return 403;
    case INTERNAL_WORK_ERRORS.ALREADY_COMPLETED:
      return 409;
    default:
      return 400;
  }
}

/** Sends the error CODE only — never a note body, a title or a patient detail. */
function fail(res, err, label) {
  const code = err instanceof InternalWorkError ? err.code : "internal_error";
  if (!(err instanceof InternalWorkError)) console.error(label, err?.message || err);
  return res.status(statusFor(code)).json({ ok: false, error: code });
}

/* ============================================================ internal notes */

router.get(
  "/internal-notes",
  requirePracticePatientLinkAccess({ permission: PERMISSIONS.INTERNAL_NOTES_READ }),
  async (req, res) => {
    try {
      const notes = await listInternalNotes({
        linkId: req.linkAccess.linkId,
        practiceProfileId: req.linkAccess.practiceProfileId,
        actorUserId: req.user.userId,
      });
      return res.json({ ok: true, notes });
    } catch (err) {
      return fail(res, err, "[practice/internal-notes:list]");
    }
  },
);

router.post(
  "/internal-notes",
  requirePracticePatientLinkAccess({ permission: PERMISSIONS.INTERNAL_NOTES_WRITE }),
  async (req, res) => {
    try {
      const note = await createInternalNote({
        linkId: req.linkAccess.linkId,
        practiceProfileId: req.linkAccess.practiceProfileId,
        actorUserId: req.user.userId,
        body: req.body?.body,
      });
      return res.status(201).json({ ok: true, note });
    } catch (err) {
      return fail(res, err, "[practice/internal-notes:create]");
    }
  },
);

router.patch(
  "/internal-notes/:noteId",
  requirePracticePatientLinkAccess({ permission: PERMISSIONS.INTERNAL_NOTES_WRITE }),
  async (req, res) => {
    try {
      const note = await updateOwnInternalNote({
        noteId: String(req.params.noteId || ""),
        linkId: req.linkAccess.linkId,
        practiceProfileId: req.linkAccess.practiceProfileId,
        actorUserId: req.user.userId,
        body: req.body?.body,
      });
      return res.json({ ok: true, note });
    } catch (err) {
      return fail(res, err, "[practice/internal-notes:update]");
    }
  },
);

/* ================================================================= reminders */

router.get(
  "/reminders",
  requirePracticePatientLinkAccess({ permission: PERMISSIONS.REMINDERS_READ }),
  async (req, res) => {
    try {
      const requested = String(req.query?.status || "all");
      const status = ["open", "completed", "all"].includes(requested) ? requested : "all";
      const reminders = await listReminders({
        linkId: req.linkAccess.linkId,
        practiceProfileId: req.linkAccess.practiceProfileId,
        status,
      });
      return res.json({ ok: true, reminders });
    } catch (err) {
      return fail(res, err, "[practice/reminders:list]");
    }
  },
);

router.post(
  "/reminders",
  requirePracticePatientLinkAccess({ permission: PERMISSIONS.REMINDERS_WRITE }),
  async (req, res) => {
    try {
      const reminder = await createReminder({
        linkId: req.linkAccess.linkId,
        practiceProfileId: req.linkAccess.practiceProfileId,
        actorUserId: req.user.userId,
        title: req.body?.title,
        dueAt: req.body?.dueAt,
        assignedToUserId: req.body?.assignedToUserId,
      });
      return res.status(201).json({ ok: true, reminder });
    } catch (err) {
      return fail(res, err, "[practice/reminders:create]");
    }
  },
);

router.post(
  "/reminders/:reminderId/complete",
  requirePracticePatientLinkAccess({ permission: PERMISSIONS.REMINDERS_WRITE }),
  async (req, res) => {
    try {
      const reminder = await completeReminder({
        reminderId: String(req.params.reminderId || ""),
        linkId: req.linkAccess.linkId,
        practiceProfileId: req.linkAccess.practiceProfileId,
        actorUserId: req.user.userId,
      });
      return res.json({ ok: true, reminder });
    } catch (err) {
      return fail(res, err, "[practice/reminders:complete]");
    }
  },
);

export default router;
