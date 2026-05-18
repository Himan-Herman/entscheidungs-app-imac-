import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/dashboard";

export async function fetchPracticeOverviewSummary(practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`${BASE}/summary?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeOverviewActivity(practiceId, limit = 12) {
  const q = new URLSearchParams({ practiceId, limit: String(limit) });
  const res = await authFetch(`${BASE}/recent-activity?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPracticeOverviewAiSummary(practiceId, locale) {
  const res = await authFetch(`${BASE}/ai-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId, locale }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
