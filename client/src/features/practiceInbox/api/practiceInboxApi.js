import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/inbox";

export async function fetchPracticeInbox(practiceId, params = {}) {
  const q = new URLSearchParams({ practiceId });
  if (params.filter) q.set("filter", params.filter);
  if (params.type) q.set("type", params.type);
  if (params.q) q.set("q", params.q);
  if (params.sort) q.set("sort", params.sort);
  if (params.limit != null) q.set("limit", String(params.limit));
  const res = await authFetch(`${BASE}?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeInboxItem(itemId, practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`${BASE}/${encodeURIComponent(itemId)}?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchPracticeInboxRead(itemId, practiceId) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(itemId)}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchPracticeInboxDone(itemId, practiceId) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(itemId)}/done`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchPracticeInboxArchive(itemId, practiceId) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(itemId)}/archive`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPracticeInboxAiSummary(itemId, practiceId, locale) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(itemId)}/ai-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId, locale }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPracticeInboxAiReplyDraft(itemId, practiceId, locale) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(itemId)}/ai-reply-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId, locale }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
