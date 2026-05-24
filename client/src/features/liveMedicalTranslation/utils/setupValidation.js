/** @param {string} value */
export function normalizePatientName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** @param {string} value */
export function isValidBirthDate(value) {
  if (!value || typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (date.getTime() > todayUtc) return false;
  if (year < 1900) return false;

  return true;
}

/**
 * @param {{
 *   patientName: string;
 *   birthDate: string;
 *   patientLanguage: string;
 *   doctorLanguage: string;
 * }} fields
 */
export function isSetupComplete(fields) {
  const name = normalizePatientName(fields.patientName);
  return (
    name.length > 0 &&
    isValidBirthDate(fields.birthDate) &&
    Boolean(fields.patientLanguage) &&
    Boolean(fields.doctorLanguage) &&
    fields.patientLanguage !== fields.doctorLanguage
  );
}
