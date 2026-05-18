import {
  INSURANCE_TRI_STATE,
  ORGANIZATION_TYPES,
} from "./practiceOrganizationConstants.js";

/**
 * @param {unknown} raw
 * @returns {string[] | null}
 */
export function parseJsonStringArray(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (Array.isArray(raw)) {
    const items = raw.map((x) => String(x).trim()).filter(Boolean).slice(0, 30);
    return items.length ? items : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parseJsonStringArray(parsed);
    } catch {
      /* fall through */
    }
  }
  const items = s
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);
  return items.length ? items : null;
}

/**
 * @param {string[] | null | undefined} arr
 */
export function stringifyJsonArray(arr) {
  if (!arr?.length) return null;
  return JSON.stringify(arr);
}

/**
 * @param {unknown} raw
 */
export function parseAccessibility(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return {
      wheelchair: Boolean(raw.wheelchair),
      elevator: Boolean(raw.elevator),
      accessibleEntrance: Boolean(raw.accessibleEntrance),
      accessibleRestroom: Boolean(raw.accessibleRestroom),
    };
  }
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    return parseAccessibility(parsed);
  } catch {
    return null;
  }
}

/**
 * @param {import('@prisma/client').PracticeProfile} row
 */
export function organizationProfileExtras(row) {
  const specialties = parseJsonStringArray(row.specialtiesJson);
  const accessibility = parseAccessibility(row.accessibilityJson);
  const langs = parseJsonStringArray(row.supportedLanguages);

  return {
    organizationType: row.organizationType || null,
    specialties: specialties || (row.specialty ? [row.specialty] : []),
    stateRegion: row.stateRegion || null,
    acceptsPublicInsurance: INSURANCE_TRI_STATE.has(row.acceptsPublicInsurance || "")
      ? row.acceptsPublicInsurance
      : null,
    acceptsPrivateInsurance: INSURANCE_TRI_STATE.has(row.acceptsPrivateInsurance || "")
      ? row.acceptsPrivateInsurance
      : null,
    acceptsSelfPay: INSURANCE_TRI_STATE.has(row.acceptsSelfPay || "")
      ? row.acceptsSelfPay
      : null,
    emergencyCareAvailable: row.emergencyCareAvailable ?? null,
    onlineAppointmentsAvailable: row.onlineAppointmentsAvailable ?? null,
    videoConsultationAvailable: row.videoConsultationAvailable ?? null,
    accessibility,
    languages: langs || [],
  };
}

/**
 * @param {string | undefined} v
 */
export function normalizeOrganizationType(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (!ORGANIZATION_TYPES.has(s)) throw new Error("organizationType_invalid");
  return s;
}

/**
 * @param {string | undefined} v
 */
export function normalizeInsuranceTriState(v) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (!INSURANCE_TRI_STATE.has(s)) throw new Error("insurance_option_invalid");
  return s;
}

/**
 * @param {import('@prisma/client').PracticeMember} row
 */
export function memberProfileExtras(row) {
  return {
    displayName: row.displayName || null,
    positionTitle: row.positionTitle || null,
    specialty: row.specialty || null,
    languages: parseJsonStringArray(row.languagesJson) || [],
    visibleToPatients: Boolean(row.visibleToPatients),
    acceptsPatientRequests: row.acceptsPatientRequests !== false,
    doctorTitle: row.doctorTitle || null,
    focusArea: row.focusArea || null,
    officeHours: row.officeHours || null,
    internalContact: row.internalContact || null,
    onlineAppointmentsAvailable: row.onlineAppointmentsAvailable ?? null,
    videoConsultationAvailable: row.videoConsultationAvailable ?? null,
    lastActiveAt: row.lastActiveAt || null,
  };
}

/**
 * @param {import('@prisma/client').PracticePatientLink} row
 */
export function assignmentExtras(row) {
  return {
    assignmentStatus: row.assignmentStatus || "unassigned",
    assignedDoctorUserId: row.assignedDoctorUserId || null,
    assignedTeamMemberUserId: row.assignedTeamMemberUserId || null,
    assignedByUserId: row.assignedByUserId || null,
    assignedAt: row.assignedAt || null,
    assignmentNote: row.assignmentNote || null,
    lastForwardedAt: row.lastForwardedAt || null,
    patientSelectedDoctorUserId: row.patientSelectedDoctorUserId || null,
  };
}
