/**
 * Practice-local patient entries and their invitations.
 * Mounted at /api/practice/patient-entries (requireAuth applied by app.js).
 * Requires PATIENT_ONBOARDING_V2=true.
 *
 * THE AUTHORIZATION RULE OF THIS FILE
 * -----------------------------------
 * `practiceId` arrives from the client, but only ever as a QUESTION — "which of
 * my practices am I acting in?" — never as an answer. The answer comes from
 * `getPracticeAccess`, which returns null unless this user really owns or
 * actively belongs to that practice, and every subsequent query is scoped by
 * `access.practiceId`. A `practiceProfileId` in a request BODY is ignored
 * entirely; it is not read anywhere below.
 *
 * Entry ids are never authorization on their own: each lookup passes both the id
 * and the resolved practice, and an entry belonging to somebody else answers
 * exactly like one that does not exist.
 */

import express from "express";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import { requirePatientOnboardingFeature } from "../middleware/requirePatientOnboarding.js";
import { getPracticeAccess, accessHasPermission } from "../utils/practiceAccess.js";
import { invitationIssueLimiter } from "../middleware/ipRateLimit.js";
import {
  createPracticePatientEntry,
  getPracticePatientEntry,
  listPracticePatientEntries,
  archivePracticePatientEntry,
} from "../services/patientOnboarding/practicePatientEntryService.js";
import {
  createInvitationForEntry,
  listInvitationsForEntry,
} from "../services/patientOnboarding/practicePatientInvitationService.js";

const router = express.Router();

router.use(requirePatientOnboardingFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (
    msg === "validation_required" ||
    msg === "validation_name_required" ||
    msg === "validation_invalid_date" ||
    msg === "validation_invalid_email"
  ) {
    return { status: 400, error: msg };
  }
  if (msg === "entry_not_found") return { status: 404, error: msg };
  if (msg === "practice_not_found") return { status: 404, error: msg };
  if (
    msg === "entry_already_archived" ||
    msg === "entry_archived" ||
    msg === "entry_not_invitable" ||
    msg === "practice_inactive"
  ) {
    return { status: 409, error: msg };
  }
  // Everything else, including a unique-constraint violation from a lost race,
  // is reported as one opaque failure. The database's own message would name
  // tables, columns and index predicates.
  return { status: 500, error: "request_failed" };
}

/**
 * Resolve the practice this request acts in, and check one capability.
 *
 * Returns the access object or sends the response itself, so a handler that
 * forgets to check cannot continue: it gets `null` and must return.
 */
async function requirePracticeCapability(req, res, permission) {
  const userId = userIdFromReq(req);
  if (!userId) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
  }
  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    res.status(400).json({ ok: false, error: "practiceId_required" });
    return null;
  }
  const access = await getPracticeAccess(userId, practiceId);
  // Not a member and lacking the capability are the same answer on purpose:
  // distinguishing them would confirm that a given practice id exists.
  if (!access || !accessHasPermission(access, permission)) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return { access, userId, practiceProfileId: access.practiceId };
}

/** POST /api/practice/patient-entries — create a practice-local record only. */
router.post("/", async (req, res) => {
  const ctx = await requirePracticeCapability(req, res, PERMISSIONS.PATIENT_LINKS_WRITE);
  if (!ctx) return undefined;

  try {
    const result = await createPracticePatientEntry({
      req,
      practiceProfileId: ctx.practiceProfileId,
      createdByUserId: ctx.userId,
      givenName: req.body?.givenName,
      familyName: req.body?.familyName,
      dateOfBirth: req.body?.dateOfBirth ?? null,
      email: req.body?.email ?? null,
      phone: req.body?.phone ?? null,
      practiceRecordNumber: req.body?.practiceRecordNumber ?? null,
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped.status === 500) console.error("[practice/patient-entries:create]", err?.message ?? err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patient-entries?practiceId=&q=&status=&limit=&offset= */
router.get("/", async (req, res) => {
  const ctx = await requirePracticeCapability(req, res, PERMISSIONS.PATIENT_LINKS_READ);
  if (!ctx) return undefined;

  try {
    const result = await listPracticePatientEntries(ctx.practiceProfileId, {
      status: String(req.query.status || "").trim() || undefined,
      q: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
      includeArchived: req.query.includeArchived === "true",
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped.status === 500) console.error("[practice/patient-entries:list]", err?.message ?? err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patient-entries/:entryId?practiceId= */
router.get("/:entryId", async (req, res) => {
  const ctx = await requirePracticeCapability(req, res, PERMISSIONS.PATIENT_LINKS_READ);
  if (!ctx) return undefined;

  try {
    const entry = await getPracticePatientEntry(req.params.entryId, ctx.practiceProfileId);
    return res.json({ ok: true, entry });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped.status === 500) console.error("[practice/patient-entries:get]", err?.message ?? err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patient-entries/:entryId/archive */
router.post("/:entryId/archive", async (req, res) => {
  const ctx = await requirePracticeCapability(req, res, PERMISSIONS.PATIENT_LINKS_WRITE);
  if (!ctx) return undefined;

  try {
    const entry = await archivePracticePatientEntry({
      req,
      entryId: req.params.entryId,
      practiceProfileId: ctx.practiceProfileId,
      actorUserId: ctx.userId,
    });
    return res.json({ ok: true, entry });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped.status === 500) console.error("[practice/patient-entries:archive]", err?.message ?? err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patient-entries/:entryId/invitations?practiceId= */
router.get("/:entryId/invitations", async (req, res) => {
  const ctx = await requirePracticeCapability(req, res, PERMISSIONS.PATIENT_LINKS_READ);
  if (!ctx) return undefined;

  try {
    const result = await listInvitationsForEntry(req.params.entryId, ctx.practiceProfileId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped.status === 500) console.error("[practice/patient-entries:invitations]", err?.message ?? err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * Issue an invitation.
 *
 * `POST .../invitations` and `POST .../invitations/regenerate` deliberately run
 * the SAME code path. "Issue the first one" and "replace the current one" differ
 * only in what the practice believes the state to be, and the belief can be
 * stale — a colleague may have sent one thirty seconds ago. Two implementations
 * would mean two chances to forget the supersede, and the one that forgot would
 * fail on exactly the entries that already had an invitation.
 *
 * The response is the only place the plaintext token ever exists.
 */
async function issueInvitation(req, res) {
  const ctx = await requirePracticeCapability(req, res, PERMISSIONS.PATIENT_LINKS_WRITE);
  if (!ctx) return undefined;

  try {
    const result = await createInvitationForEntry({
      req,
      entryId: req.params.entryId,
      practiceProfileId: ctx.practiceProfileId,
      createdByUserId: ctx.userId,
      // No delivery channel is accepted from the client. This phase delivers
      // nothing, so there is no truthful value to record.
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped.status === 500) console.error("[practice/patient-entries:invite]", err?.message ?? err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
}

router.post("/:entryId/invitations", invitationIssueLimiter, issueInvitation);
router.post("/:entryId/invitations/regenerate", invitationIssueLimiter, issueInvitation);

export default router;
