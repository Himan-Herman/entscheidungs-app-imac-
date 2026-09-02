/**
 * Practice-side actions on an existing invitation.
 * Mounted at /api/practice/patient-invitations (requireAuth applied by app.js).
 * Requires PATIENT_ONBOARDING_V2=true.
 *
 * Same rule as the entries router: the invitation id never authorizes by itself.
 * Both handlers resolve the practice from the caller's membership first and pass
 * it into the service, which scopes the row by it — so an invitation belonging
 * to another practice is reported exactly like one that does not exist.
 *
 * Creating invitations lives in the entries router, where the entry is: an
 * invitation is always issued FOR something, never on its own.
 */

import express from "express";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import { requirePatientOnboardingFeature } from "../middleware/requirePatientOnboarding.js";
import { getPracticeAccess, accessHasPermission } from "../utils/practiceAccess.js";
import { invitationIssueLimiter } from "../middleware/ipRateLimit.js";
import {
  revokeInvitation,
  rotateManualCode,
} from "../services/patientOnboarding/practicePatientInvitationService.js";

const router = express.Router();

router.use(requirePatientOnboardingFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required") return { status: 400, error: msg };
  if (msg === "invitation_not_found") return { status: 404, error: msg };
  if (msg === "invitation_not_pending") return { status: 409, error: msg };
  return { status: 500, error: "request_failed" };
}

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
  if (!access || !accessHasPermission(access, permission)) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return { access, userId, practiceProfileId: access.practiceId };
}

/**
 * POST /api/practice/patient-invitations/:invitationId/revoke
 *
 * Idempotent for the only repeat that makes sense: revoking something already
 * revoked succeeds and says so, because the caller's intent is satisfied and
 * failing would only produce a retry loop. Revoking something REDEEMED or
 * SUPERSEDED is a genuine conflict — the practice believes it is withdrawing
 * access that this row no longer controls — and returns 409.
 */
router.post("/:invitationId/revoke", async (req, res) => {
  const ctx = await requirePracticeCapability(req, res, PERMISSIONS.PATIENT_LINKS_WRITE);
  if (!ctx) return undefined;

  try {
    const result = await revokeInvitation({
      req,
      invitationId: req.params.invitationId,
      practiceProfileId: ctx.practiceProfileId,
      actorUserId: ctx.userId,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped.status === 500) console.error("[practice/patient-invitations:revoke]", err?.message ?? err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * POST /api/practice/patient-invitations/:invitationId/manual-code
 *
 * Issues a fresh 60-minute on-site code on THIS invitation. No new invitation,
 * nothing superseded, `expiresAt` untouched. The plaintext is in the response
 * and nowhere else.
 */
router.post("/:invitationId/manual-code", invitationIssueLimiter, async (req, res) => {
  const ctx = await requirePracticeCapability(req, res, PERMISSIONS.PATIENT_LINKS_WRITE);
  if (!ctx) return undefined;

  try {
    const result = await rotateManualCode({
      req,
      invitationId: req.params.invitationId,
      practiceProfileId: ctx.practiceProfileId,
      actorUserId: ctx.userId,
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped.status === 500) console.error("[practice/patient-invitations:manual-code]", err?.message ?? err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
