/**
 * Medical Interpreter — encrypted cloud session routes.
 * Route layer only: auth, rate limits, validation, service delegation.
 */

import express from "express";
import {
  interpreterCloudDeleteLimiter,
  interpreterCloudReadLimiter,
  interpreterCloudSharedLimiter,
  interpreterCloudWriteLimiter,
} from "../middleware/interpreterRateLimit.js";
import {
  limitInterpreterCloudRequestBody,
  requireCloudAuthenticatedUser,
  requireInterpreterCloudEnabled,
} from "../middleware/interpreterCloudMiddleware.js";
import { auditInterpreterCloud } from "../services/interpreter/interpreterCloudAudit.js";
import {
  sendCloudGeneric500,
  sendCloudServiceError,
  sendCloudValidationError,
} from "../services/interpreter/interpreterCloudErrors.js";
import {
  createCloudSession,
  deleteAllCloudSessions,
  deleteCloudSession,
  getCloudSessionByClientId,
  getCloudStorageStatus,
  listCloudSessions,
  updateCloudSession,
} from "../services/interpreter/interpreterCloudSessionService.js";
import {
  validateClientSessionIdParam,
  validateInterpreterCloudSessionBody,
} from "../services/interpreter/interpreterCloudSessionValidation.js";

const router = express.Router();

/** GET /api/interpreter/sessions — metadata list (no turn plaintext). */
router.get(
  "/sessions",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudReadLimiter,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;

    try {
      const result = await listCloudSessions(userId);
      return res.json({
        ok: true,
        ...getCloudStorageStatus(),
        sessions: result.sessions,
      });
    } catch {
      auditInterpreterCloud({
        req,
        userId,
        action: "interpreter_cloud_session_list_failed",
        result: "failed",
      });
      return sendCloudGeneric500(res, "Could not load sessions.");
    }
  },
);

/** POST /api/interpreter/sessions — create (requires cloudStorageConsent + account consent). */
router.post(
  "/sessions",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudWriteLimiter,
  limitInterpreterCloudRequestBody,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;

    const validated = validateInterpreterCloudSessionBody(req.body);
    if (!validated.ok) {
      auditInterpreterCloud({
        req,
        userId,
        action: "interpreter_cloud_session_create_denied",
        result: "denied",
        metadata: { code: validated.code },
      });
      return sendCloudValidationError(res, validated);
    }

    try {
      const result = await createCloudSession(userId, validated, req);
      if (!result.ok) return sendCloudServiceError(res, result);
      return res.status(201).json({ ok: true, session: result.session });
    } catch {
      auditInterpreterCloud({
        req,
        userId,
        action: "interpreter_cloud_session_create_failed",
        result: "failed",
      });
      return sendCloudGeneric500(res, "Could not save session.");
    }
  },
);

/** DELETE /api/interpreter/sessions — delete all cloud sessions for user. */
router.delete(
  "/sessions",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudDeleteLimiter,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;

    try {
      const result = await deleteAllCloudSessions(userId, req);
      return res.json(result);
    } catch {
      auditInterpreterCloud({
        req,
        userId,
        action: "interpreter_cloud_delete_all_failed",
        result: "failed",
      });
      return sendCloudGeneric500(res, "Could not delete cloud sessions.");
    }
  },
);

/** GET /api/interpreter/sessions/:id — full session with decrypted turns. */
router.get(
  "/sessions/:id",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudReadLimiter,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;

    const idCheck = validateClientSessionIdParam(req.params.id);
    if (!idCheck.ok) return sendCloudValidationError(res, idCheck);

    try {
      const result = await getCloudSessionByClientId(
        userId,
        idCheck.clientSessionId,
      );
      if (!result.ok) return sendCloudServiceError(res, result);
      return res.json({ ok: true, session: result.session });
    } catch {
      auditInterpreterCloud({
        req,
        userId,
        action: "interpreter_cloud_session_read_failed",
        result: "failed",
        metadata: { clientSessionId: idCheck.clientSessionId },
      });
      return sendCloudGeneric500(res, "Could not load session.");
    }
  },
);

/** PUT /api/interpreter/sessions/:id — update (requires active consent). */
router.put(
  "/sessions/:id",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudWriteLimiter,
  limitInterpreterCloudRequestBody,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;

    const idCheck = validateClientSessionIdParam(req.params.id);
    if (!idCheck.ok) return sendCloudValidationError(res, idCheck);

    const validated = validateInterpreterCloudSessionBody(req.body);
    if (!validated.ok) {
      auditInterpreterCloud({
        req,
        userId,
        action: "interpreter_cloud_session_update_denied",
        result: "denied",
        metadata: { code: validated.code, clientSessionId: idCheck.clientSessionId },
      });
      return sendCloudValidationError(res, validated);
    }

    try {
      const result = await updateCloudSession(
        userId,
        idCheck.clientSessionId,
        validated,
        req,
      );
      if (!result.ok) return sendCloudServiceError(res, result);
      return res.json({ ok: true, session: result.session });
    } catch {
      auditInterpreterCloud({
        req,
        userId,
        action: "interpreter_cloud_session_update_failed",
        result: "failed",
        metadata: { clientSessionId: idCheck.clientSessionId },
      });
      return sendCloudGeneric500(res, "Could not update session.");
    }
  },
);

/** DELETE /api/interpreter/sessions/:id — delete one session (no consent required). */
router.delete(
  "/sessions/:id",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudDeleteLimiter,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;

    const idCheck = validateClientSessionIdParam(req.params.id);
    if (!idCheck.ok) return sendCloudValidationError(res, idCheck);

    try {
      const result = await deleteCloudSession(
        userId,
        idCheck.clientSessionId,
        req,
      );
      if (!result.ok) return sendCloudServiceError(res, result);
      return res.json(result);
    } catch {
      auditInterpreterCloud({
        req,
        userId,
        action: "interpreter_cloud_session_delete_failed",
        result: "failed",
        metadata: { clientSessionId: idCheck.clientSessionId },
      });
      return sendCloudGeneric500(res, "Could not delete session.");
    }
  },
);

export default router;
