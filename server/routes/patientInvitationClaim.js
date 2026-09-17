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
} from "../middleware/ipRateLimit.js";
import {
  claimInvitation,
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
