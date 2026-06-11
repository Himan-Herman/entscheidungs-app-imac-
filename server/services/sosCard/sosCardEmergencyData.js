/**
 * Shared helpers for SOS-Karte emergency output.
 *
 * Age, height and weight are NOT stored on SosCard — they are referenced read-only from the
 * existing profile (User.dateOfBirth, UserProfile.heightCm / weightKg) to avoid duplicating data.
 * All values are patient self-reported; no medical verification exists.
 */

/** Whole years from a date of birth, or null. Uses request-time "now". */
export function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  if (age < 0 || age > 150) return null;
  return age;
}

/** Defensive read-side guard — only surface a plausible height (30–250 cm). */
export function plausibleHeightCm(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 30 && value <= 250
    ? Math.round(value)
    : null;
}

/** Defensive read-side guard — only surface a plausible weight (1–350 kg). */
export function plausibleWeightKg(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 350
    ? value
    : null;
}

/** Coerce stored JSON into a safe array, or [] on anything unexpected. */
export function asEmergencyList(value) {
  return Array.isArray(value) ? value : [];
}
