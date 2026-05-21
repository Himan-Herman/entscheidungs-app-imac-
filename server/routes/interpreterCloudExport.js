/**
 * GET /api/interpreter/cloud/export — JSON export of account backup sessions (patient-owned).
 */

import express from "express";
import {
  interpreterCloudReadLimiter,
  interpreterCloudSharedLimiter,
} from "../middleware/interpreterRateLimit.js";
import { requireCloudAuthenticatedUser } from "../middleware/interpreterCloudAuth.js";
import { requireInterpreterCloudEnabled } from "../middleware/interpreterCloudMiddleware.js";
import { auditInterpreterCloud } from "../services/interpreter/interpreterCloudAudit.js";
import {
  sendCloudGeneric500,
  sendCloudServiceError,
} from "../services/interpreter/interpreterCloudErrors.js";
import { exportInterpreterCloudSessions } from "../services/interpreter/interpreterCloudExportService.js";

const router = express.Router();

router.get(
  "/cloud/export",
  requireInterpreterCloudEnabled,
  interpreterCloudSharedLimiter,
  interpreterCloudReadLimiter,
  async (req, res) => {
    const userId = requireCloudAuthenticatedUser(req, res);
    if (!userId) return undefined;

    try {
      const result = await exportInterpreterCloudSessions(userId, req);
      if (!result.ok) return sendCloudServiceError(res, result);

      const filename = `medscout-interpreter-cloud-export-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(result.export);
    } catch {
      auditInterpreterCloud({
        req,
        userId,
        action: "interpreter_cloud_export_failed",
        result: "failed",
      });
      return sendCloudGeneric500(res, "Could not export cloud sessions.");
    }
  },
);

export default router;
