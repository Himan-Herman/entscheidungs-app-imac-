import { getPracticeAccess, hasPracticePermission, PERMISSIONS } from "./practiceAccess.js";

/**
 * Owner/admin security & DSGVO overview access.
 * @param {string} userId
 * @param {string} practiceId
 */
export async function requireSecurityView(userId, practiceId) {
  const access = await getPracticeAccess(userId, practiceId);
  if (!access) {
    const err = new Error("forbidden");
    err.code = "forbidden";
    throw err;
  }
  if (!hasPracticePermission(access.role, PERMISSIONS.SECURITY_VIEW)) {
    const err = new Error("forbidden");
    err.code = "forbidden";
    throw err;
  }
  return access;
}

/**
 * @param {string | null | undefined} role
 */
export function canViewSecurityOverview(role) {
  return hasPracticePermission(role, PERMISSIONS.SECURITY_VIEW);
}
