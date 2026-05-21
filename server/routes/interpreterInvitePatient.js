/**
 * Authenticated patient routes for interpreter invite sharing (Phase 4).
 */

import express from "express";
import { isMedicalInterpreterB2bEnabled } from "../config/featureFlags.js";
import { getAuthenticatedUserId } from "../middleware/interpreterPracticeAccess.js";
import {
  interpreterInviteShareLimiter,
} from "../middleware/interpreterRateLimit.js";
import {
  grantPracticeShareViaInvite,
} from "../services/interpreter/interpreterPracticeShareService.js";

const router = express.Router();

const B2B_DISABLED_BODY = {
  ok: false,
  error: "medical_interpreter_b2b_disabled",
  message: "Practice sharing is not available.",
};

function requireInterpreterB2bEnabled(_req, res, next) {
  if (!isMedicalInterpreterB2bEnabled()) {
    return res.status(503).json(B2B_DISABLED_BODY);
  }
  return next();
}

/**
 * POST /api/interpreter/invite/:token/consent
 * Patient grants explicit practice sharing for a session snapshot.
 */
router.post(
  "/invite/:token/consent",
  requireInterpreterB2bEnabled,
  interpreterInviteShareLimiter,
  async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: "Authentication required.",
      });
    }
    try {
      const token = String(req.params.token || "").trim();
      const result = await grantPracticeShareViaInvite(
        req,
        token,
        userId,
        req.body || {},
      );
      return res.status(result.status || (result.ok ? 200 : 400)).json(result);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Could not record sharing consent.",
      });
    }
  },
);

export default router;
