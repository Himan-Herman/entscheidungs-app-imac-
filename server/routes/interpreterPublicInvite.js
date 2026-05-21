/**
 * Public Medical Interpreter invite validation (Phase 4.6).
 * No authentication — minimal safe response only.
 */

import express from "express";
import { isMedicalInterpreterB2bEnabled } from "../config/featureFlags.js";
import {
  interpreterInviteShareLimiter,
} from "../middleware/interpreterRateLimit.js";
import { getPublicInterpreterInviteStatus } from "../services/interpreter/interpreterPracticeInviteService.js";
import { startInterpreterInviteSession } from "../services/interpreter/interpreterPracticeShareService.js";

const router = express.Router();

import { isMedicalInterpreterEnabled } from "../config/featureFlags.js";

const B2B_DISABLED_BODY = {
  ok: true,
  valid: false,
  state: "unavailable",
  message: "Invitation validation is not available.",
  communicationNotice:
    "Multilingual communication support only. This is not medical diagnosis, triage, or treatment advice.",
  interpreterEnabled: isMedicalInterpreterEnabled(),
};

/**
 * GET /api/interpreter/invite/:token/status
 */
router.get("/invite/:token/status", async (req, res) => {
  if (!isMedicalInterpreterB2bEnabled()) {
    return res.json(B2B_DISABLED_BODY);
  }

  try {
    const token = String(req.params.token || "").trim();
    const body = await getPublicInterpreterInviteStatus(req, token);
    return res.json(body);
  } catch {
    return res.json({
      ok: true,
      valid: false,
      state: "invalid",
      message: "This invitation link is not available.",
      communicationNotice:
        "Multilingual communication support only. This is not medical diagnosis, triage, or treatment advice.",
    });
  }
});

/**
 * POST /api/interpreter/invite/:token/start
 * Records invite usage; does not grant practice access to session content.
 */
router.post("/invite/:token/start", interpreterInviteShareLimiter, async (req, res) => {
  if (!isMedicalInterpreterB2bEnabled()) {
    return res.json(B2B_DISABLED_BODY);
  }
  try {
    const token = String(req.params.token || "").trim();
    const body = await startInterpreterInviteSession(req, token);
    return res.json(body);
  } catch {
    return res.json({
      ok: true,
      started: false,
      valid: false,
      state: "invalid",
      message: "This invitation link is not available.",
      communicationNotice:
        "Multilingual communication support only. This is not medical diagnosis, triage, or treatment advice.",
    });
  }
});

export default router;
