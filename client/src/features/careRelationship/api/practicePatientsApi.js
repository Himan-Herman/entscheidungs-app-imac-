import { authFetch } from "../../../api/authFetch.js";

/**
 * @param {string} practiceId
 * @param {{ status?: string, limit?: number, offset?: number }} [opts]
 */
export async function fetchPracticePatients(practiceId, opts = {}) {
  const q = new URLSearchParams();
  q.set("practiceId", practiceId);
  if (opts.status) q.set("status", opts.status);
  if (opts.limit != null) q.set("limit", String(opts.limit));
  if (opts.offset != null) q.set("offset", String(opts.offset));
  const res = await authFetch(`/api/practice/patients?${q.toString()}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * @param {string} linkId
 * @param {string} practiceId
 */
export async function fetchPracticePatientLink(linkId, practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}?${q.toString()}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticePatientActivity(linkId, practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/activity?${q.toString()}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticePatientPreVisits(linkId, practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/pre-visits?${q.toString()}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
