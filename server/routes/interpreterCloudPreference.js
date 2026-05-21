/**
 * Medical Interpreter — account-level cloud consent routes.
 */

import express from "express";
import {
  interpreterCloudReadLimiter,
  interpreterCloudSharedLimiter,
  interpreterCloudWriteLimiter,
} from "../middleware/interpreterRateLimit.js";
import {
  requireCloudAuthenticatedUser,
  requireInterpreterCloudEnabled,
} from "../middleware/interpreterCloudMiddleware.js";
import {
  sendCloudGeneric500,
  sendCloudServiceError,
} from "../services/interpreter/interpreterCloudErrors.js";
import {
  getCloudConsentHistory,
  getCloudPreference,
  grantCloudConsent,
  revokeCloudConsent,
} from "../services/interpreter/interpreterCloudConsentService.js";

const router = express.Router();

/** GET /api/interpreter/cloud/preference */
router.get(
  "/cloud/preference",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudReadLimiter,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;
    try {
      return res.json(await getCloudPreference(userId));
    } catch {
      return sendCloudGeneric500(res, "Could not load cloud preference.");
    }
  },
);

/** POST /api/interpreter/cloud/consent/grant */
router.post(
  "/cloud/consent/grant",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudWriteLimiter,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;
    try {
      const result = await grantCloudConsent(userId, req);
      if (!result.ok) return sendCloudServiceError(res, result);
      return res.json(result);
    } catch {
      return sendCloudGeneric500(res, "Could not enable cloud storage.");
    }
  },
);

/** GET /api/interpreter/cloud/consent/history */
router.get(
  "/cloud/consent/history",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudReadLimiter,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;
    try {
      return res.json(await getCloudConsentHistory(userId));
    } catch {
      return sendCloudGeneric500(res, "Could not load consent history.");
    }
  },
);

/** POST /api/interpreter/cloud/consent/revoke — body: { deleteCloudData?: boolean } */
router.post(
  "/cloud/consent/revoke",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudWriteLimiter,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;
    const deleteCloudData = req.body?.deleteCloudData === true;
    try {
      return res.json(
        await revokeCloudConsent(userId, req, { deleteCloudData }),
      );
    } catch {
      return sendCloudGeneric500(res, "Could not revoke cloud consent.");
    }
  },
);

export default router;
