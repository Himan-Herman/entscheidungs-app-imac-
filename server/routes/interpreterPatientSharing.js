/**
 * Patient-controlled interpreter practice sharing (Phase 4).
 */

import express from "express";
import { isMedicalInterpreterB2bEnabled } from "../config/featureFlags.js";
import { getAuthenticatedUserId } from "../middleware/interpreterPracticeAccess.js";
import { interpreterInviteShareLimiter } from "../middleware/interpreterRateLimit.js";
import {
  grantPracticeShareForPatient,
  listPatientPracticeShares,
  resolvePracticeShareContext,
  revokePracticeShareForPatient,
} from "../services/interpreter/interpreterPracticeShareService.js";

const router = express.Router();

function requireB2b(_req, res, next) {
  if (!isMedicalInterpreterB2bEnabled()) {
    return res.status(503).json({
      ok: false,
      error: "medical_interpreter_b2b_disabled",
      message: "Practice sharing is not available.",
    });
  }
  return next();
}

router.use(requireB2b);

/** GET /api/interpreter/sharing */
router.get("/sharing", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  try {
    const result = await listPatientPracticeShares(userId);
    return res.json(result);
  } catch {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /api/interpreter/sharing/consent */
router.post("/sharing/consent", interpreterInviteShareLimiter, async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  try {
    const ctx = await resolvePracticeShareContext(req.body || {});
    if (!ctx.ok) {
      return res.status(ctx.status || 403).json(ctx);
    }
    const result = await grantPracticeShareForPatient(
      req,
      userId,
      ctx.practiceProfileId,
      ctx.inviteId,
      req.body || {},
    );
    return res.status(result.status || (result.ok ? 200 : 400)).json(result);
  } catch {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /api/interpreter/sharing/:linkId/revoke */
router.post("/sharing/:linkId/revoke", interpreterInviteShareLimiter, async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  try {
    const result = await revokePracticeShareForPatient(
      req,
      userId,
      String(req.params.linkId || "").trim(),
      { deleteSharedCopy: req.body?.deleteSharedCopy === true },
    );
    return res.status(result.status || 200).json(result);
  } catch {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
