/**
 * @param {{ patient?: { firstName?: string, lastName?: string, email?: string } | null, patientProfile?: { displayName?: string } | null }} link
 * @param {string} fallbackLabel
 */
export function patientDisplayName(link, fallbackLabel) {
  const profileName = link?.patientProfile?.displayName?.trim();
  if (profileName) return profileName;

  const first = link?.patient?.firstName?.trim() || "";
  const last = link?.patient?.lastName?.trim() || "";
  const full = `${first} ${last}`.trim();
  if (full) return full;

  return fallbackLabel;
}
