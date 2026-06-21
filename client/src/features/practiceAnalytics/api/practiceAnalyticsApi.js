import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/analytics";

/**
 * Aggregated practice usage / ROI overview (read-only, counts only).
 * @param {string} practiceId
 * @param {{ days?: number }} opts
 */
export async function fetchPracticeAnalyticsOverview(practiceId, { days } = {}) {
  const q = new URLSearchParams({ practiceId });
  if (days != null) q.set("days", String(days));
  const res = await authFetch(`${BASE}/overview?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
