import { authFetch } from "../../../api/authFetch.js";

export async function fetchPracticePatientProfile(linkId, practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/profile?${q}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
