/**
 * Practice access checks for Medical Interpreter B2B routes.
 * Requires authenticated user, practiceId query param, and interpreter.view permission.
 */

import { getPracticeAccess } from "../utils/practiceAccess.js";
import {
  canAdminInterpreterPractice,
  canExportInterpreterPractice,
  canInviteInterpreterPractice,
  canManageInterpreterPractice,
  canViewInterpreterPractice,
} from "../utils/practicePermissions.js";

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function getAuthenticatedUserId(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requirePracticeInterpreterAccess(req, res, next) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: "Authentication required.",
    });
  }

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({
      ok: false,
      error: "practiceId_required",
      message: "Practice context is required.",
    });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canViewInterpreterPractice(access.role)) {
    return res.status(403).json({
      ok: false,
      error: "forbidden",
      message: "You do not have permission to access interpreter practice features.",
    });
  }

  req.practiceId = practiceId;
  req.practiceAccess = access;
  req.interpreterPracticePermissions = {
    canView: true,
    canInvite: canInviteInterpreterPractice(access.role),
    canManage: canManageInterpreterPractice(access.role),
    canExport: canExportInterpreterPractice(access.role),
    canAdmin: canAdminInterpreterPractice(access.role),
  };
  return next();
}

/**
 * Requires interpreter.manage (create/revoke invites).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requirePracticeInterpreterManage(req, res, next) {
  await requirePracticeInterpreterAccess(req, res, () => {
    if (res.headersSent) return;
    const perms = req.interpreterPracticePermissions;
    if (!perms?.canManage && !perms?.canInvite) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
        message: "You do not have permission to manage interpreter invites.",
      });
    }
    return next();
  });
}
