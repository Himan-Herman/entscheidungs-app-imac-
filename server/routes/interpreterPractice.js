/**
 * Medical Interpreter — B2B practice/clinic API (Phase 4).
 * Communication support only; no diagnosis/triage/treatment paths.
 */

import express from "express";
import {
  isMedicalInterpreterB2bEnabled,
  isMedicalInterpreterEnabled,
} from "../config/featureFlags.js";
import {
  getAuthenticatedUserId,
  requirePracticeInterpreterAccess,
  requirePracticeInterpreterManage,
} from "../middleware/interpreterPracticeAccess.js";
import {
  canAdminInterpreterPractice,
  canExportInterpreterPractice,
  canInviteInterpreterPractice,
  canManageInterpreterPractice,
  canViewInterpreterPractice,
} from "../utils/practicePermissions.js";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import {
  interpreterPracticeSessionReadLimiter,
} from "../middleware/interpreterRateLimit.js";
import {
  getPracticeInterpreterProfile,
  getPracticeSharedSessionDetail,
  listPracticeSharedSessions,
  revokePracticeSessionLinkByPractice,
} from "../services/interpreter/interpreterPracticeShareService.js";
import interpreterPracticeInvitesRouter from "./interpreterPracticeInvites.js";

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

router.get("/status", async (req, res) => {
  const b2bEnabled = isMedicalInterpreterB2bEnabled();
  const practiceId = String(req.query.practiceId || "").trim();

  /** @type {Record<string, unknown>} */
  const body = {
    ok: true,
    enabled: b2bEnabled,
    b2bEnabled,
    interpreterEnabled: isMedicalInterpreterEnabled(),
    message: b2bEnabled
      ? "Medical Interpreter practice layer is enabled."
      : "Medical Interpreter practice layer is disabled.",
  };

  if (practiceId && b2bEnabled) {
    const userId = getAuthenticatedUserId(req);
    if (userId) {
      const access = await getPracticeAccess(userId, practiceId);
      body.practiceId = practiceId;
      body.practiceAccess = access
        ? {
            role: access.role,
            canView: canViewInterpreterPractice(access.role),
            canInvite: canInviteInterpreterPractice(access.role),
            canManage: canManageInterpreterPractice(access.role),
            canExport: canExportInterpreterPractice(access.role),
            canAdmin: canAdminInterpreterPractice(access.role),
          }
        : null;
    }
  }

  return res.json(body);
});

router.get(
  "/profile",
  requireInterpreterB2bEnabled,
  requirePracticeInterpreterAccess,
  async (req, res) => {
    try {
      const result = await getPracticeInterpreterProfile(req.practiceId);
      return res.status(result.status || 200).json(result);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Could not load practice interpreter profile.",
      });
    }
  },
);

router.get(
  "/sessions",
  requireInterpreterB2bEnabled,
  requirePracticeInterpreterAccess,
  interpreterPracticeSessionReadLimiter,
  async (req, res) => {
    try {
      const result = await listPracticeSharedSessions(req.practiceId);
      return res.json(result);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Could not load shared sessions.",
      });
    }
  },
);

router.get(
  "/sessions/:id",
  requireInterpreterB2bEnabled,
  requirePracticeInterpreterAccess,
  interpreterPracticeSessionReadLimiter,
  async (req, res) => {
    try {
      const result = await getPracticeSharedSessionDetail(
        req,
        req.practiceId,
        req.user.userId,
        String(req.params.id || "").trim(),
      );
      return res.status(result.status || (result.ok ? 200 : 404)).json(result);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Could not load session documentation.",
      });
    }
  },
);

router.post(
  "/session-links/:id/revoke",
  requireInterpreterB2bEnabled,
  requirePracticeInterpreterManage,
  async (req, res) => {
    try {
      const result = await revokePracticeSessionLinkByPractice(
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
        message: "Could not revoke session link.",
      });
    }
  },
);

router.use("/invites", interpreterPracticeInvitesRouter);

export default router;
