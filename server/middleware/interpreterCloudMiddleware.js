/**
 * Shared middleware for Medical Interpreter cloud routes.
 */

import { isInterpreterCloudEnabled } from "../config/featureFlags.js";
import { INTERPRETER_CLOUD_MAX_REQUEST_BODY_BYTES } from "../config/interpreterCloudEnv.js";
import { auditInterpreterCloud } from "../services/interpreter/interpreterCloudAudit.js";
import {
  CLOUD_DISABLED_BODY,
  CLOUD_PAYLOAD_TOO_LARGE_BODY,
} from "../services/interpreter/interpreterCloudErrors.js";
import {
  getCloudAuthenticatedUserId,
} from "./interpreterCloudAuth.js";

/** @param {import('express').Request} req */
function auditUserId(req) {
  return getCloudAuthenticatedUserId(req) || req.userId || null;
}

export function requireInterpreterCloudEnabled(req, res, next) {
  if (!isInterpreterCloudEnabled()) {
    auditInterpreterCloud({
      req,
      userId: auditUserId(req),
      action: "interpreter_cloud_access_denied",
      result: "denied",
      metadata: { reason: "feature_disabled" },
    });
    return res.status(503).json(CLOUD_DISABLED_BODY);
  }
  return next();
}

export { requireCloudAuthenticatedUser } from "./interpreterCloudAuth.js";

/**
 * Reject oversized JSON bodies before handler work (abuse protection).
 */
export function limitInterpreterCloudRequestBody(req, res, next) {
  const raw = req.headers["content-length"];
  if (raw == null || raw === "") return next();
  const len = Number(raw);
  if (!Number.isFinite(len) || len < 0) return next();
  if (len > INTERPRETER_CLOUD_MAX_REQUEST_BODY_BYTES) {
    auditInterpreterCloud({
      req,
      userId: auditUserId(req),
      action: "interpreter_cloud_request_rejected",
      result: "denied",
      metadata: { reason: "body_too_large", contentLength: len },
    });
    return res.status(413).json(CLOUD_PAYLOAD_TOO_LARGE_BODY);
  }
  return next();
}
