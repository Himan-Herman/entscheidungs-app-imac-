/**
 * Resolves authenticated patient user id for interpreter cloud routes.
 * JWT payload is on req.user (requireAuth), not req.userId.
 */

import { CLOUD_UNAUTHORIZED_BODY } from "../services/interpreter/interpreterCloudErrors.js";

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function getCloudAuthenticatedUserId(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {string | undefined} userId when authenticated; otherwise response already sent
 */
export function requireCloudAuthenticatedUser(req, res) {
  const userId = getCloudAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json(CLOUD_UNAUTHORIZED_BODY);
    return undefined;
  }
  req.userId = userId;
  return userId;
}
