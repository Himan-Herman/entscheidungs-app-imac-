/**
 * Central practice role → permission matrix (server-side source of truth).
 */

export const PRACTICE_ROLES = ["owner", "admin", "doctor", "assistant", "viewer"];

export const PERMISSIONS = {
  TEAM_VIEW: "team.view",
  TEAM_MANAGE: "team.manage",
  AUDIT_VIEW: "audit.view",
  SETTINGS_MANAGE: "settings.manage",
  INTEGRATIONS_MANAGE: "integrations.manage",
  PATIENT_LINKS_READ: "patient_links.read",
  PATIENT_LINKS_WRITE: "patient_links.write",
  MESSAGES_SEND: "messages.send",
  INBOX_MANAGE: "inbox.manage",
  DOCUMENTS_READ: "documents.read",
  DOCUMENTS_WRITE: "documents.write",
  DOCUMENTS_DELETE: "documents.delete",
  MEDICATION_READ: "medication.read",
  MEDICATION_WRITE: "medication.write",
  MEDICATION_PUBLISH: "medication.publish",
  DATA_REQUESTS_MANAGE: "data_requests.manage",
};

/** @type {Record<string, Set<string>>} */
const ROLE_PERMISSIONS = {
  owner: new Set(Object.values(PERMISSIONS)),
  admin: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.PATIENT_LINKS_READ,
    PERMISSIONS.PATIENT_LINKS_WRITE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_WRITE,
    PERMISSIONS.DOCUMENTS_DELETE,
    PERMISSIONS.MEDICATION_READ,
    PERMISSIONS.MEDICATION_WRITE,
    PERMISSIONS.MEDICATION_PUBLISH,
    PERMISSIONS.DATA_REQUESTS_MANAGE,
  ]),
  doctor: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.PATIENT_LINKS_READ,
    PERMISSIONS.PATIENT_LINKS_WRITE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_WRITE,
    PERMISSIONS.DOCUMENTS_DELETE,
    PERMISSIONS.MEDICATION_READ,
    PERMISSIONS.MEDICATION_WRITE,
    PERMISSIONS.MEDICATION_PUBLISH,
    PERMISSIONS.DATA_REQUESTS_MANAGE,
  ]),
  assistant: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.PATIENT_LINKS_READ,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_WRITE,
    PERMISSIONS.MEDICATION_READ,
  ]),
  viewer: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.PATIENT_LINKS_READ,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.MEDICATION_READ,
    PERMISSIONS.INBOX_MANAGE,
  ]),
};

/**
 * @param {string | null | undefined} role
 * @param {string} permission
 */
export function hasPracticePermission(role, permission) {
  const r = String(role || "").trim();
  const set = ROLE_PERMISSIONS[r];
  if (!set) return false;
  return set.has(permission);
}

/**
 * @param {string | null | undefined} role
 */
export function permissionsForRole(role) {
  const r = String(role || "").trim();
  const set = ROLE_PERMISSIONS[r];
  if (!set) return [];
  return [...set];
}

/**
 * @param {string | null | undefined} role
 */
export function canManageTeam(role) {
  return hasPracticePermission(role, PERMISSIONS.TEAM_MANAGE);
}

export function canReadPracticePatientLinks(role) {
  return hasPracticePermission(role, PERMISSIONS.PATIENT_LINKS_READ);
}

export function canWritePracticePatientLinks(role) {
  return hasPracticePermission(role, PERMISSIONS.PATIENT_LINKS_WRITE);
}

export function canManageIntegrations(role) {
  return hasPracticePermission(role, PERMISSIONS.INTEGRATIONS_MANAGE);
}

export function canViewIntegrationSettings(role) {
  return (
    hasPracticePermission(role, PERMISSIONS.INTEGRATIONS_MANAGE) ||
    hasPracticePermission(role, PERMISSIONS.SETTINGS_MANAGE) ||
    ["owner", "admin", "doctor", "assistant", "viewer"].includes(String(role || ""))
  );
}

export function canAccessPracticeDataApi(role) {
  return canReadPracticePatientLinks(role);
}

/**
 * Human-readable matrix for API/UI (no medical content).
 */
export function getPermissionMatrix() {
  return PRACTICE_ROLES.map((role) => ({
    role,
    permissions: permissionsForRole(role),
  }));
}
