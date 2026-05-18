import { authFetch } from "../../../api/authFetch.js";

/**
 * @param {string} practiceId
 * @param {{
 *   q?: string;
 *   status?: string;
 *   profileShared?: boolean;
 *   hasUnreadMessages?: boolean;
 *   hasDocuments?: boolean;
 *   hasMedicationPlan?: boolean;
 *   hasOpenDataRequest?: boolean;
 *   sortBy?: string;
 *   sortDirection?: string;
 *   page?: number;
 *   limit?: number;
 * }} [opts]
 */
export async function fetchPracticePatients(practiceId, opts = {}) {
  const q = new URLSearchParams();
  q.set("practiceId", practiceId);
  if (opts.q) q.set("q", opts.q);
  if (opts.status) q.set("status", opts.status);
  if (opts.profileShared === true) q.set("profileShared", "true");
  if (opts.profileShared === false) q.set("profileShared", "false");
  if (opts.hasUnreadMessages === true) q.set("hasUnreadMessages", "true");
  if (opts.hasUnreadMessages === false) q.set("hasUnreadMessages", "false");
  if (opts.hasDocuments === true) q.set("hasDocuments", "true");
  if (opts.hasDocuments === false) q.set("hasDocuments", "false");
  if (opts.hasMedicationPlan === true) q.set("hasMedicationPlan", "true");
  if (opts.hasMedicationPlan === false) q.set("hasMedicationPlan", "false");
  if (opts.hasOpenDataRequest === true) q.set("hasOpenDataRequest", "true");
  if (opts.hasOpenDataRequest === false) q.set("hasOpenDataRequest", "false");
  if (opts.sortBy) q.set("sortBy", opts.sortBy);
  if (opts.sortDirection) q.set("sortDirection", opts.sortDirection);
  if (opts.page != null) q.set("page", String(opts.page));
  if (opts.limit != null) q.set("limit", String(opts.limit));
  const res = await authFetch(`/api/practice/patients?${q.toString()}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPracticePatientSearchAiSuggestion(practiceId, { q, filters, locale } = {}) {
  const res = await authFetch("/api/practice/patients/search/ai-filter-suggestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId, q, filters, locale }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticePatientRecordSearch(linkId, practiceId, query) {
  const q = new URLSearchParams({ practiceId });
  if (query) q.set("q", query);
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/search?${q.toString()}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * @param {string} linkId
 * @param {string} practiceId
 */
export async function fetchPracticePatientLink(linkId, practiceId, opts = {}) {
  const q = new URLSearchParams({ practiceId });
  if (opts.fromSearch) q.set("fromSearch", "true");
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}?${q.toString()}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticePatientActivity(linkId, practiceId, params = {}) {
  const q = new URLSearchParams({ practiceId });
  if (params.type) q.set("type", params.type);
  if (params.q) q.set("q", params.q);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/activity?${q.toString()}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPracticePatientActivityAiSummary(linkId, practiceId, locale) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/activity/ai-summary?${q}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    },
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
