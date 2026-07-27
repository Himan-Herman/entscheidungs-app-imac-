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
  /**
   * Prescriptions (e-Rezept) are deliberately NOT covered by the medication.*
   * permissions: a medication plan is documentation, a prescription is a
   * medical act.
   *
   * Four concepts must be kept apart:
   *   1. organizational tenant role   -> PracticeProfile.userId ("owner")
   *   2. medical occupational role    -> PracticeMember.role === "doctor"
   *   3. verified professional status -> DOES NOT EXIST in this data model
   *   4. concrete prescribing right   -> PRESCRIPTION_ISSUE / _CANCEL
   *
   * (3) is the problem: nothing in the schema proves a medical qualification.
   * `User.verified` is e-mail verification only; `PracticeMember.role`,
   * `doctorTitle` and `specialty` are self-declared free text set by whoever
   * owns the practice, and any authenticated user can create a practice and
   * become its owner. "owner" is organizational ownership, not a clinician.
   *
   * Therefore ISSUE and CANCEL are granted to NO role (deny by default) until
   * a verifiable clinician attribute exists. See ISSUE_REQUIRES_VERIFIED_CLINICIAN.
   * No PRESCRIPTION_DRAFT exists because ErezeptEntry has no draft state.
   */
  PRESCRIPTION_READ: "prescription.read",
  PRESCRIPTION_ISSUE: "prescription.issue",
  PRESCRIPTION_CANCEL: "prescription.cancel",
  /**
   * Clinical content permissions.
   *
   * PATIENT_LINKS_READ means "may see that this practice has a care
   * relationship with this patient, and the administrative basics of it".
   * It deliberately does NOT imply access to health data — that is what these
   * separate permissions are for. Every clinical route requires the matching
   * CLINICAL_* permission in addition to the patient's consent.
   *
   * CLINICAL_AI_SUMMARY_GENERATE is a PROCESSING right, not a read right:
   * generating a summary sends Art. 9 GDPR health data to an external AI
   * processor. Holding CLINICAL_HEALTH_HISTORY_READ must never imply it, so the
   * AI route requires BOTH.
   */
  CLINICAL_VITALS_READ: "clinical.vitals.read",
  CLINICAL_VACCINATIONS_READ: "clinical.vaccinations.read",
  CLINICAL_HEALTH_HISTORY_READ: "clinical.health_history.read",
  CLINICAL_SOS_READ: "clinical.sos.read",
  CLINICAL_AI_SUMMARY_GENERATE: "clinical.ai_summary.generate",
  /**
   * Approve, reject or revoke someone else's CLINICAL role. Deliberately its
   * own permission and NOT derived from TEAM_MANAGE-style reasoning at the call
   * site: granting a clinical standing is a different decision from managing
   * organizational team membership. Never grants the clinical role itself.
   */
  CLINICAL_ROLE_MANAGE: "clinical.role.manage",
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

/**
 * Permissions that NO role may hold until a verifiable professional
 * qualification exists in the data model.
 *
 * MODEL GAP (documented, not worked around): nothing in the schema proves a
 * medical qualification. `User.verified` is e-mail verification; `role`,
 * `doctorTitle` and `specialty` on PracticeMember are self-declared free text,
 * assigned by whoever owns the practice — and any authenticated user can create
 * a practice and become its owner without any check. A role name is therefore
 * not evidence of authorization.
 *
 * Where the line is drawn:
 *  - Reading clinical data inside an ESTABLISHED, patient-consented care
 *    relationship rests on the patient's explicit consent for that practice.
 *    Roles then allocate need-to-know inside the practice. That is workable
 *    without professional verification.
 *  - Issuing or cancelling a prescription is a regulated medical act with legal
 *    effect. Patient consent cannot substitute for professional licensure, so
 *    these stay denied.
 *  - Sending health data to an external AI processor is a separate processing
 *    purpose. The route checks consent type "health_history_access", which is a
 *    consent to SHARE WITH THE PRACTICE, not to process externally. Until a
 *    dedicated legal basis is wired (an "ai_organizational_assistance" consent
 *    type already exists but is not checked here), this stays denied too.
 */
export const REQUIRES_VERIFIED_QUALIFICATION = Object.freeze([
  PERMISSIONS.PRESCRIPTION_READ,
  PERMISSIONS.PRESCRIPTION_ISSUE,
  PERMISSIONS.PRESCRIPTION_CANCEL,
  PERMISSIONS.CLINICAL_AI_SUMMARY_GENERATE,
]);

/**
 * Permissions that touch patient health data. An approved CLINICAL role
 * contributes ONLY these — never organizational power. So approving someone's
 * clinical "doctor" role can never hand them TEAM_MANAGE, DOCUMENTS_DELETE or
 * any other administrative right that the `doctor` allowlist happens to carry.
 */
export const CLINICAL_PERMISSIONS = Object.freeze([
  PERMISSIONS.CLINICAL_VITALS_READ,
  PERMISSIONS.CLINICAL_VACCINATIONS_READ,
  PERMISSIONS.CLINICAL_HEALTH_HISTORY_READ,
  PERMISSIONS.CLINICAL_SOS_READ,
  PERMISSIONS.CLINICAL_AI_SUMMARY_GENERATE,
]);

const CLINICAL_PERMISSION_SET = new Set(CLINICAL_PERMISSIONS);

/** Clinical roles that may be assigned in addition to an organizational role. */
export const ASSIGNABLE_CLINICAL_ROLES = Object.freeze(["doctor"]);

/** Clinical role lifecycle. Only "active" grants anything. */
export const CLINICAL_ROLE_STATUSES = Object.freeze([
  "pending",
  "active",
  "rejected",
  "revoked",
]);

/**
 * The clinical subset of a role's allowlist. An unknown or non-assignable role
 * yields nothing, so a stray value in the column can never widen access.
 *
 * @param {string | null | undefined} clinicalRole
 * @returns {string[]}
 */
export function clinicalPermissionsForRole(clinicalRole) {
  const r = String(clinicalRole || "").trim();
  if (!ASSIGNABLE_CLINICAL_ROLES.includes(r)) return [];
  return permissionsForRole(r).filter((p) => CLINICAL_PERMISSION_SET.has(p));
}

/**
 * Explicit allowlist per role. Never derive a role from Object.values() — a new
 * permission must always be an opt-in decision per role, never something a role
 * silently inherits because it was added to the enum.
 *
 * `owner` is an ORGANIZATIONAL role (the account that created the practice).
 * Ownership alone does not establish a treatment relationship, so it carries
 * full administrative power but NO clinical read rights. An owner who also
 * treats patients holds an additional CLINICAL role on the same PracticeMember
 * row (`clinicalRole` + `clinicalRoleStatus`), approved by a different eligible
 * person — the owner membership itself is never downgraded to "doctor".
 *
 * @type {Record<string, Set<string>>}
 */
const ROLE_PERMISSIONS = {
  owner: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.CLINICAL_ROLE_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.SECURITY_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.INTEGRATIONS_EXPORT,
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
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.CALENDAR_SETTINGS,
    PERMISSIONS.TELEMEDICINE_READ,
    PERMISSIONS.TELEMEDICINE_MANAGE,
    PERMISSIONS.TELEMEDICINE_SETTINGS,
    PERMISSIONS.ANAMNESIS_READ,
    PERMISSIONS.ANAMNESIS_MANAGE,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.INTERPRETER_VIEW,
    PERMISSIONS.INTERPRETER_INVITE,
    PERMISSIONS.INTERPRETER_MANAGE,
    PERMISSIONS.INTERPRETER_EXPORT,
    PERMISSIONS.INTERPRETER_ADMIN,
    // NO CLINICAL_* and NO PRESCRIPTION_*: ownership is not a care relationship.
  ]),
  admin: new Set([
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.CLINICAL_ROLE_MANAGE,
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
    // NO CLINICAL_* and NO PRESCRIPTION_*: administering a practice does not
    // require reading a patient's health data.
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
    PERMISSIONS.CLINICAL_ROLE_MANAGE,
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
    PERMISSIONS.TELEMEDICINE_READ,
    PERMISSIONS.TELEMEDICINE_MANAGE,
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
    // Treating clinician — the only role with a treatment purpose for health
    // data. Reading rests on the patient's per-practice consent; the role
    // allocates need-to-know inside the practice.
    PERMISSIONS.CLINICAL_VITALS_READ,
    PERMISSIONS.CLINICAL_VACCINATIONS_READ,
    PERMISSIONS.CLINICAL_HEALTH_HISTORY_READ,
    PERMISSIONS.CLINICAL_SOS_READ,
    // NO CLINICAL_AI_SUMMARY_GENERATE (external processing, separate legal
    // basis) and NO PRESCRIPTION_* (regulated act, needs licensure).
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
    // NO CLINICAL_*: an assistant plausibly performs delegated tasks such as
    // taking vitals or maintaining the vaccination record, which would justify
    // CLINICAL_VITALS_READ / CLINICAL_VACCINATIONS_READ. Denied by default
    // anyway, because "assistant" is a self-assigned label and no concrete
    // workflow requirement has been established. Grant deliberately if needed.
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
    // NO CLINICAL_*: a read-only observer role has no treatment purpose.
  ]),
};

/**
 * Guard: no role may hold a permission that requires a professional
 * qualification the data model cannot express. Enforced at module load so a
 * future grant cannot slip through review.
 */
for (const [role, granted] of Object.entries(ROLE_PERMISSIONS)) {
  for (const permission of REQUIRES_VERIFIED_QUALIFICATION) {
    if (granted.has(permission)) {
      throw new Error(
        `Role "${role}" must not hold "${permission}" — see REQUIRES_VERIFIED_QUALIFICATION.`,
      );
    }
  }
}

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
