/**
 * Patient-side claim of a practice invitation.
 * Mounted at /api/patient/invitations (requireAuth applied by app.js).
 * Requires PATIENT_ONBOARDING_V2=true.
 *
 * A claim is a deliberate, authenticated act: the patient states WHICH
 * credential they hold and WHO the relationship is for. Neither is inferred.
 * The preview endpoints stay public and read-only; binding never happens there.
 */

import express from "express";
import { requirePatientOnboardingFeature } from "../middleware/requirePatientOnboarding.js";
import {
  invitationClaimIpLimiter,
  invitationClaimUserLimiter,
  invitationManualCodeLimiter,
  invitationPreviewLimiter,
} from "../middleware/ipRateLimit.js";
import {
  checkClaimEligibility,
  claimInvitation,
  CLAIMER_IS_PRACTICE_TEAM,
  GENERIC_CLAIM_ERROR,
} from "../services/patientOnboarding/practicePatientClaimService.js";

const router = express.Router();

router.use(requirePatientOnboardingFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Credential failures are one answer; everything else is a real, nameable
 * situation the holder of a VALID credential is entitled to understand.
 */
function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === GENERIC_CLAIM_ERROR) return { status: 404, error: GENERIC_CLAIM_ERROR };
  // Valid credential, wrong account: the caller works at the issuing practice.
  if (msg === CLAIMER_IS_PRACTICE_TEAM) return { status: 403, error: msg };
  if (msg === "validation_credential_required"
      || msg === "validation_subject_required"
      || msg === "validation_subject_invalid"
      || msg === "validation_required") {
    return { status: 400, error: msg };
  }
  if (msg === "claim_subject_mismatch") return { status: 409, error: msg };
  if (msg === "entry_not_claimable") return { status: 409, error: msg };
  if (msg === "link_already_bound_to_entry") return { status: 409, error: msg };
  // Two lost races in a row against an older link writer. A conflict the caller
  // can retry, not a server fault.
  if (msg === "link_already_exists") return { status: 409, error: msg };
  return { status: 500, error: "request_failed" };
}

/**
 * The same IP budget as the public check of the same credential kind. Without
 * this, the authenticated eligibility check would be a second, looser way to
 * test hand-typed codes.
 */
function credentialLimiter(req, res, next) {
  const limiter = req.body?.code ? invitationManualCodeLimiter : invitationPreviewLimiter;
  return limiter(req, res, next);
}

/**
 * POST /api/patient/invitations/eligibility
 *
 * Body: exactly one of `token` or `code`. Read-only — it changes nothing and
 * binds nothing. Answers, before the patient taps "connect", whether THIS
 * account may redeem the credential at all, so a practice team account is told
 * up front instead of after a failed attempt. A credential the public preview
 * rejects is rejected here with the same generic answer.
 */
router.post("/eligibility", credentialLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await checkClaimEligibility({
      userId,
      token: req.body?.token ?? null,
      code: req.body?.code ?? null,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped.status === 500) console.error("[patient/invitations:eligibility]", err?.message ?? err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * POST /api/patient/invitations/claim
 *
 * Body: exactly one of `token` or `code`, plus a mandatory `subject`:
 *   { "token": "...", "subject": { "type": "self" } }
 *   { "code": "ABCD-EFGH-JKLM",
 *     "subject": { "type": "patient_profile", "patientProfileId": "..." } }
 *
 * Both credentials or neither is a 400 — which one was spent must never be
 * ambiguous. The two limiters below bound one network address and one account
 * separately, and the user limiter sits after requireAuth so it has an identity
 * to key on.
 */
router.post(
  "/claim",
  invitationClaimIpLimiter,
  invitationClaimUserLimiter,
  async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    try {
      const result = await claimInvitation({
        req,
        userId,
        token: req.body?.token ?? null,
        code: req.body?.code ?? null,
        subject: req.body?.subject,
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      const mapped = mapError(err);
      if (mapped.status === 500) console.error("[patient/invitations:claim]", err?.message ?? err);
      return res.status(mapped.status).json({ ok: false, error: mapped.error });
    }
  },
);

export default router;
