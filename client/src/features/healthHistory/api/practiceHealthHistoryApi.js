import { authFetch } from "../../../api/authFetch.js";

export async function fetchPracticePatientHealthHistory(linkId, practiceId) {
  const params = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/health-history?${params}`
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeHealthHistoryAiSummary(linkId, practiceId, locale = "de") {
  const params = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/health-history/ai-summary?${params}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    }
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
