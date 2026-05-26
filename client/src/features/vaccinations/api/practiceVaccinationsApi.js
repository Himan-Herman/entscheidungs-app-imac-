import { authFetch } from "../../../api/authFetch.js";

/**
 * Fetch a patient's shared vaccination entries as a practice staff member.
 * @param {string} linkId
 * @param {string} practiceId
 */
export async function fetchPracticePatientVaccinations(linkId, practiceId) {
  const params = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/vaccinations?${params}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
