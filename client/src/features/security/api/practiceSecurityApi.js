import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/security";

export async function fetchSecuritySummary(practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`${BASE}/summary?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchSecurityEvents(practiceId, { limit } = {}) {
  const q = new URLSearchParams({ practiceId });
  if (limit) q.set("limit", String(limit));
  const res = await authFetch(`${BASE}/events?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postSecurityAiSummary(practiceId, locale) {
  const res = await authFetch(`${BASE}/ai-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId, locale }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
