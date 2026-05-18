import {
  hasPracticePermission,
  PERMISSIONS,
  canWritePracticePatientLinks,
} from "./practicePermissions.js";

/** Archive / revoke share — not for viewer. */
export function canPracticeArchive(role) {
  return canWritePracticePatientLinks(role);
}

/** Soft-delete documents / medication plans — owner, admin, doctor only. */
export function canPracticeSoftDelete(role) {
  return hasPracticePermission(role, PERMISSIONS.DOCUMENTS_DELETE);
}

/** Restore from archive — owner / admin only (MVP). */
export function canPracticeRestoreFromArchive(role) {
  return hasPracticePermission(role, PERMISSIONS.SETTINGS_MANAGE);
}
