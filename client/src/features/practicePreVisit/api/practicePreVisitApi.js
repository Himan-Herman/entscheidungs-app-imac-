import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/pre-visit";

/**
 * Practice-side appointment-preparation setup overview (read-only, metadata only).
 * @param {string} practiceId
 */
export async function fetchPracticePreVisitSetup(practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`${BASE}/setup?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
