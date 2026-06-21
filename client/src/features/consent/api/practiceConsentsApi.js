import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/consents";

/**
 * Practice-side consent overview (read-only, metadata only).
 * @param {string} practiceId
 * @param {{ limit?: number, offset?: number }} opts
 */
export async function fetchPracticeConsentOverview(practiceId, { limit = 50, offset = 0 } = {}) {
  const q = new URLSearchParams({
    practiceId,
    limit: String(limit),
    offset: String(offset),
  });
  const res = await authFetch(`${BASE}/overview?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
