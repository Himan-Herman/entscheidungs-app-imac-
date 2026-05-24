import { authFetch } from "../../../api/authFetch.js";
import { LIVE_TRANSLATION_LANGUAGE_CODES } from "../languages.js";
import { normalizePatientName } from "./setupValidation.js";
import { mapProfileGenderToCode } from "./genderFormOfAddress.js";

/** @typedef {{
 *   patientName: string;
 *   birthDate: string;
 *   genderOrFormOfAddress: import("./genderFormOfAddress.js").GenderFormOfAddressCode;
 *   patientLanguage: string;
 *   doctorLanguage: string;
 * }} LiveTranslationProfilePrefill */

/**
 * @param {string | null | undefined} code
 * @returns {boolean}
 */
function isLiveTranslationLanguage(code) {
  return Boolean(code && LIVE_TRANSLATION_LANGUAGE_CODES.includes(String(code).toLowerCase()));
}

/**
 * @param {{ firstName?: string; lastName?: string; dateOfBirth?: string | null }} user
 * @param {{
 *   displayName?: string | null;
 *   genderOrSalutation?: string | null;
 *   preferredPatientLanguage?: string | null;
 *   preferredDoctorLanguage?: string | null;
 * }} profile
 * @returns {LiveTranslationProfilePrefill | null}
 */
export function mapPatientSettingsToPrefill(user, profile) {
  const patientName = normalizePatientName(
    profile?.displayName?.trim() || `${user?.firstName || ""} ${user?.lastName || ""}`,
  );
  const birthDate = user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : "";
  const genderOrFormOfAddress = mapProfileGenderToCode(profile?.genderOrSalutation);
  const patientLanguage = isLiveTranslationLanguage(profile?.preferredPatientLanguage)
    ? String(profile.preferredPatientLanguage).toLowerCase()
    : "";
  const doctorLanguage = isLiveTranslationLanguage(profile?.preferredDoctorLanguage)
    ? String(profile.preferredDoctorLanguage).toLowerCase()
    : "";

  const hasAny =
    patientName.length > 0 ||
    birthDate.length > 0 ||
    genderOrFormOfAddress.length > 0 ||
    patientLanguage.length > 0 ||
    doctorLanguage.length > 0;

  if (!hasAny) return null;

  return {
    patientName,
    birthDate,
    genderOrFormOfAddress,
    patientLanguage,
    doctorLanguage,
  };
}

/**
 * Load logged-in patient profile for Meda setup prefill. Returns null if unavailable.
 * @returns {Promise<LiveTranslationProfilePrefill | null>}
 */
export async function fetchLiveTranslationProfilePrefill() {
  if (typeof window === "undefined") return null;
  if (!window.localStorage.getItem("medscout_token")) return null;

  try {
    const res = await authFetch("/api/account/patient-settings");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return mapPatientSettingsToPrefill(data.user || {}, data.profile || {});
  } catch (err) {
    if (err && typeof err === "object" && "message" in err && err.message === "SESSION_EXPIRED") {
      return null;
    }
    return null;
  }
}
