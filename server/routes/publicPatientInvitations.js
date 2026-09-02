/**
 * Public invitation preview — no authentication.
 * Mounted at /api/public/patient-invitations.
 * Requires PATIENT_ONBOARDING_V2=true.
 *
 * Both endpoints are POST and both are strictly read-only. The verb is about
 * where the secret travels — in a request body, never in a URL — not about what
 * happens: neither handler writes anything.
 *
 * This router answers exactly one question — "who is inviting me, and is this
 * still valid?" — and it answers it WITHOUT writing anything. There is no
 * redeem here, no claim, no link, no account.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN
 * ------------------------------------
 * No patient name, no given name, no date of birth, no e-mail, no practice-local
 * record number, nothing medical, no identifier of any kind — not the practice
 * id, not the entry id, not the invitation id — and no statement about whether
 * an account exists. Whoever holds the credential learns who is inviting them —
 * which they must, or they cannot decide whether to accept — and nothing about
 * the person being invited. A link forwarded to the wrong phone therefore
 * discloses a practice's name, never a patient's.
 * [Juristische Prüfung erforderlich] for the exact permitted minimum.
 *
 * EVERY FAILURE LOOKS THE SAME
 * ----------------------------
 * Unknown, expired, spent, revoked, replaced and inactive-practice all return
 * one identical error. Telling them apart would turn this endpoint into an
 * oracle: "expired" confirms the credential was once real, which is precisely
 * the bit an attacker wants.
 */

import express from "express";
import { requirePatientOnboardingFeature } from "../middleware/requirePatientOnboarding.js";
import {
  invitationPreviewLimiter,
  invitationManualCodeLimiter,
} from "../middleware/ipRateLimit.js";
import {
  previewInvitationByToken,
  previewInvitationByManualCode,
  GENERIC_CREDENTIAL_ERROR,
} from "../services/patientOnboarding/practicePatientInvitationService.js";

const router = express.Router();

router.use(requirePatientOnboardingFeature);

/**
 * ONE answer for every rejection.
 *
 * A credential that was never real, one that ran out, one already spent, one
 * withdrawn, one replaced, and one belonging to a practice that has been
 * switched off are indistinguishable here — same status, same body, byte for
 * byte. Any difference would be an oracle: "expired" confirms the string was
 * genuine, and a distinct "practice inactive" would disclose an organisation's
 * operational state to someone holding nothing but a token.
 *
 * Only a genuine server fault answers differently, and it names nothing.
 */
function respondToCredentialError(res, err, tag) {
  if (err?.message === GENERIC_CREDENTIAL_ERROR) {
    return res.status(404).json({ ok: false, error: GENERIC_CREDENTIAL_ERROR });
  }
  console.error(tag, err?.message ?? err);
  return res.status(500).json({ ok: false, error: "request_failed" });
}

/**
 * POST /api/public/patient-invitations/preview
 *
 * READ ONLY, despite the verb. Nothing on this path writes: expiry is decided by
 * comparing dates, not by updating a row, so a bot replaying it a thousand times
 * changes no state.
 *
 * POST exists solely to keep the token out of the URL. This string becomes a
 * real claim credential in the next phase, and a path or query parameter is
 * copied, unasked, into HTTP access logs, reverse-proxy logs, browser history,
 * Referer headers and tracing spans — five stores nobody is protecting as if
 * they held credentials.
 *
 * The invitation link is therefore planned as a client-side URL carrying the
 * secret in the FRAGMENT (/patient-invitation#token=...), which browsers never
 * transmit. The page reads it and posts it here in a body. That frontend is not
 * part of this phase; this endpoint is what it will call.
 */
router.post("/preview", invitationPreviewLimiter, async (req, res) => {
  try {
    const result = await previewInvitationByToken(req.body?.token);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return respondToCredentialError(res, err, "[public/patient-invitations:preview]");
  }
});

/**
 * POST /api/public/patient-invitations/manual-code/check
 *
 * Also strictly read-only, and NOT a redeem — it answers whether a typed code is
 * currently good, which the claim phase will later build on.
 *
 * POST rather than GET purely to keep a short, hand-typed credential out of URLs,
 * access logs and Referer headers. The verb is about where the secret travels,
 * not about what happens: this handler writes nothing at all.
 */
router.post("/manual-code/check", invitationManualCodeLimiter, async (req, res) => {
  try {
    const result = await previewInvitationByManualCode(req.body?.code);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return respondToCredentialError(res, err, "[public/patient-invitations:manual-code]");
  }
});

export default router;
