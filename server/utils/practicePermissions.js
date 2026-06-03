/**
 * Central practice role → permission matrix (server-side source of truth).
 */

export const PRACTICE_ROLES = [
  "owner",
  "admin",
  "doctor",
  "secretary",
  "assistant",
  "practice_manager",
  "viewer",
];

export const PERMISSIONS = {
  TEAM_VIEW: "team.view",
  TEAM_MANAGE: "team.manage",
  AUDIT_VIEW: "audit.view",
  SECURITY_VIEW: "security.view",
  SETTINGS_MANAGE: "settings.manage",
  INTEGRATIONS_MANAGE: "integrations.manage",
  INTEGRATIONS_EXPORT: "integrations.export",
  PATIENT_LINKS_READ: "patient_links.read",
  PATIENT_LINKS_WRITE: "patient_links.write",
  PATIENT_ASSIGNMENT_MANAGE: "patient_assignment.manage",
  MESSAGES_SEND: "messages.send",
  INBOX_MANAGE: "inbox.manage",
  DOCUMENTS_READ: "documents.read",
  DOCUMENTS_WRITE: "documents.write",
  DOCUMENTS_DELETE: "documents.delete",
  MEDICATION_READ: "medication.read",
  MEDICATION_WRITE: "medication.write",
  MEDICATION_PUBLISH: "medication.publish",
  DATA_REQUESTS_MANAGE: "data_requests.manage",
  CALENDAR_READ: "calendar.read",
  CALENDAR_MANAGE: "calendar.manage",
  CALENDAR_SETTINGS: "calendar.settings",
  TELEMEDICINE_READ: "telemedicine.read",
  TELEMEDICINE_MANAGE: "telemedicine.manage",
  TELEMEDICINE_SETTINGS: "telemedicine.settings",
  ANAMNESIS_READ: "anamnesis.read",
  ANAMNESIS_MANAGE: "anamnesis.manage",
  /** Booking — internal appointment-request module (Phase 1A+). */
  BOOKING_READ: "booking.read",
  BOOKING_MANAGE: "booking.manage",
  /** Medical Interpreter B2B — communication support only (Phase 4.3+). */
  INTERPRETER_VIEW: "interpreter.view",
  INTERPRETER_INVITE: "interpreter.invite",
  INTERPRETER_MANAGE: "interpreter.manage",
  INTERPRETER_EXPORT: "interpreter.export",
  INTERPRETER_ADMIN: "interpreter.admin",
};

/** @type {Record<string, Set<string>>} */
const ROLE_PERMISSIONS = {
  owner: new Set(Object.values(PERMISSIONS)),
  admin: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.SECURITY_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.PATIENT_LINKS_READ,
    PERMISSIONS.PATIENT_LINKS_WRITE,
    PERMISSIONS.PATIENT_ASSIGNMENT_MANAGE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_WRITE,
    PERMISSIONS.DOCUMENTS_DELETE,
    PERMISSIONS.MEDICATION_READ,
    PERMISSIONS.MEDICATION_WRITE,
    PERMISSIONS.MEDICATION_PUBLISH,
    PERMISSIONS.DATA_REQUESTS_MANAGE,
    PERMISSIONS.INTEGRATIONS_EXPORT,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.CALENDAR_SETTINGS,
    PERMISSIONS.ANAMNESIS_READ,
    PERMISSIONS.ANAMNESIS_MANAGE,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.INTERPRETER_VIEW,
    PERMISSIONS.INTERPRETER_INVITE,
    PERMISSIONS.INTERPRETER_MANAGE,
    PERMISSIONS.INTERPRETER_EXPORT,
    PERMISSIONS.INTERPRETER_ADMIN,
  ]),
  practice_manager: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.PATIENT_LINKS_READ,
    PERMISSIONS.PATIENT_LINKS_WRITE,
    PERMISSIONS.PATIENT_ASSIGNMENT_MANAGE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_WRITE,
    PERMISSIONS.MEDICATION_READ,
    PERMISSIONS.MEDICATION_WRITE,
    PERMISSIONS.DATA_REQUESTS_MANAGE,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.CALENDAR_SETTINGS,
    PERMISSIONS.ANAMNESIS_READ,
    PERMISSIONS.ANAMNESIS_MANAGE,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.INTERPRETER_VIEW,
    PERMISSIONS.INTERPRETER_INVITE,
    PERMISSIONS.INTERPRETER_MANAGE,
    PERMISSIONS.INTERPRETER_EXPORT,
    PERMISSIONS.INTERPRETER_ADMIN,
  ]),
  secretary: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.PATIENT_LINKS_READ,
    PERMISSIONS.PATIENT_LINKS_WRITE,
    PERMISSIONS.PATIENT_ASSIGNMENT_MANAGE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_WRITE,
    PERMISSIONS.MEDICATION_READ,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.TELEMEDICINE_READ,
    PERMISSIONS.ANAMNESIS_READ,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.INTERPRETER_VIEW,
    PERMISSIONS.INTERPRETER_INVITE,
  ]),
  doctor: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.INTEGRATIONS_EXPORT,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.CALENDAR_MANAGE,
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
    PERMISSIONS.ANAMNESIS_READ,
    PERMISSIONS.ANAMNESIS_MANAGE,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.INTERPRETER_VIEW,
    PERMISSIONS.INTERPRETER_EXPORT,
  ]),
  assistant: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.PATIENT_LINKS_READ,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_WRITE,
    PERMISSIONS.MEDICATION_READ,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.TELEMEDICINE_READ,
    PERMISSIONS.TELEMEDICINE_MANAGE,
    PERMISSIONS.ANAMNESIS_READ,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.INTERPRETER_VIEW,
  ]),
  viewer: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.PATIENT_LINKS_READ,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.MEDICATION_READ,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.ANAMNESIS_READ,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.INTERPRETER_VIEW,
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

export function canManagePatientAssignment(role) {
  return hasPracticePermission(role, PERMISSIONS.PATIENT_ASSIGNMENT_MANAGE);
}

export function canManageIntegrations(role) {
  return hasPracticePermission(role, PERMISSIONS.INTEGRATIONS_MANAGE);
}

export function canExportViaIntegrations(role) {
  return (
    hasPracticePermission(role, PERMISSIONS.INTEGRATIONS_EXPORT) ||
    hasPracticePermission(role, PERMISSIONS.INTEGRATIONS_MANAGE)
  );
}

export function canViewIntegrationSettings(role) {
  return (
    hasPracticePermission(role, PERMISSIONS.INTEGRATIONS_MANAGE) ||
    hasPracticePermission(role, PERMISSIONS.SETTINGS_MANAGE) ||
    [
      "owner",
      "admin",
      "doctor",
      "secretary",
      "assistant",
      "practice_manager",
      "viewer",
    ].includes(String(role || ""))
  );
}

export function canAccessPracticeDataApi(role) {
  return canReadPracticePatientLinks(role);
}

export function canReadCalendar(role) {
  return hasPracticePermission(role, PERMISSIONS.CALENDAR_READ);
}

export function canManageCalendar(role) {
  return hasPracticePermission(role, PERMISSIONS.CALENDAR_MANAGE);
}

export function canManageCalendarSettings(role) {
  return hasPracticePermission(role, PERMISSIONS.CALENDAR_SETTINGS);
}

export function canReadTelemedicine(role) {
  return hasPracticePermission(role, PERMISSIONS.TELEMEDICINE_READ);
}

export function canManageTelemedicine(role) {
  return hasPracticePermission(role, PERMISSIONS.TELEMEDICINE_MANAGE);
}

export function canManageTelemedicineSettings(role) {
  return hasPracticePermission(role, PERMISSIONS.TELEMEDICINE_SETTINGS);
}

export function canViewInterpreterPractice(role) {
  return hasPracticePermission(role, PERMISSIONS.INTERPRETER_VIEW);
}

export function canManageInterpreterPractice(role) {
  return hasPracticePermission(role, PERMISSIONS.INTERPRETER_MANAGE);
}

export function canAdminInterpreterPractice(role) {
  return hasPracticePermission(role, PERMISSIONS.INTERPRETER_ADMIN);
}

export function canInviteInterpreterPractice(role) {
  return (
    hasPracticePermission(role, PERMISSIONS.INTERPRETER_INVITE) ||
    hasPracticePermission(role, PERMISSIONS.INTERPRETER_MANAGE) ||
    hasPracticePermission(role, PERMISSIONS.INTERPRETER_ADMIN)
  );
}

export function canExportInterpreterPractice(role) {
  return (
    hasPracticePermission(role, PERMISSIONS.INTERPRETER_EXPORT) ||
    hasPracticePermission(role, PERMISSIONS.INTERPRETER_MANAGE) ||
    hasPracticePermission(role, PERMISSIONS.INTERPRETER_ADMIN)
  );
}

export function canReadAnamnesis(role) {
  return hasPracticePermission(role, PERMISSIONS.ANAMNESIS_READ);
}

export function canManageAnamnesis(role) {
  return hasPracticePermission(role, PERMISSIONS.ANAMNESIS_MANAGE);
}

export function canReadBooking(role) {
  return hasPracticePermission(role, PERMISSIONS.BOOKING_READ);
}

export function canManageBooking(role) {
  return hasPracticePermission(role, PERMISSIONS.BOOKING_MANAGE);
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
