/**
 * Medical Interpreter — practice invite management (Phase 4.6).
 * Auth + B2B + practice RBAC. No patient or transcript data.
 */

import express from "express";
import { isMedicalInterpreterB2bEnabled } from "../config/featureFlags.js";
import {
  requirePracticeInterpreterAccess,
  requirePracticeInterpreterManage,
} from "../middleware/interpreterPracticeAccess.js";
import {
  interpreterInviteManageReadLimiter,
  interpreterInviteManageWriteLimiter,
} from "../middleware/interpreterRateLimit.js";
import {
  createPracticeInterpreterInvite,
  listPracticeInterpreterInvites,
  revokePracticeInterpreterInvite,
} from "../services/interpreter/interpreterPracticeInviteService.js";

const router = express.Router();

const B2B_DISABLED_BODY = {
  ok: false,
  error: "medical_interpreter_b2b_disabled",
  message: "Medical Interpreter practice features are not available.",
};

function requireInterpreterB2bEnabled(_req, res, next) {
  if (!isMedicalInterpreterB2bEnabled()) {
    return res.status(503).json(B2B_DISABLED_BODY);
  }
  return next();
}

router.use(requireInterpreterB2bEnabled);

/**
 * POST /api/interpreter/practice/invites?practiceId=
 */
router.post(
  "/",
  interpreterInviteManageWriteLimiter,
  requirePracticeInterpreterManage,
  async (req, res) => {
    try {
      const userId = req.user?.userId;
      const practiceId = req.practiceId;
      const result = await createPracticeInterpreterInvite(
        req,
        practiceId,
        userId,
        req.body || {},
      );
      return res.status(result.status || (result.ok ? 200 : 400)).json(result);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Could not create invite.",
      });
    }
  },
);

/**
 * GET /api/interpreter/practice/invites?practiceId=
 */
router.get(
  "/",
  interpreterInviteManageReadLimiter,
  requirePracticeInterpreterAccess,
  async (req, res) => {
    try {
      const result = await listPracticeInterpreterInvites(req.practiceId);
      return res.json(result);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Could not load invites.",
      });
    }
  },
);

/**
 * DELETE /api/interpreter/practice/invites/:id?practiceId=
 * Soft-revoke (same as POST revoke).
 */
router.delete(
  "/:id",
  interpreterInviteManageWriteLimiter,
  requirePracticeInterpreterManage,
  async (req, res) => {
    try {
      const result = await revokePracticeInterpreterInvite(
        req,
        req.practiceId,
        req.user.userId,
        String(req.params.id || "").trim(),
      );
      return res.status(result.status || 200).json(result);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Could not revoke invite.",
      });
    }
  },
);

/**
 * POST /api/interpreter/practice/invites/:id/revoke?practiceId=
 */
router.post(
  "/:id/revoke",
  interpreterInviteManageWriteLimiter,
  requirePracticeInterpreterManage,
  async (req, res) => {
    try {
      const result = await revokePracticeInterpreterInvite(
        req,
        req.practiceId,
        req.user.userId,
        String(req.params.id || "").trim(),
      );
      return res.status(result.status || 200).json(result);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Could not revoke invite.",
      });
    }
  },
);

export default router;
