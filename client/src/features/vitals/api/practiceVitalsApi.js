import { authFetch } from "../../../api/authFetch.js";

/**
 * Fetch a patient's shared vital entries as a practice staff member.
 * @param {string} linkId
 * @param {string} practiceId
 * @param {{ type?: string, limit?: number }} [options]
 */
export async function fetchPracticePatientVitals(linkId, practiceId, options = {}) {
  const params = new URLSearchParams({ practiceId });
  if (options.type) params.set("type", options.type);
  if (options.limit) params.set("limit", String(options.limit));
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/vitals?${params}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
