import { authFetch } from "../../../api/authFetch.js";

const base = (linkId) => `/api/practice/patients/${encodeURIComponent(linkId)}/erezept`;

export async function fetchPracticeErezept(linkId, practiceId) {
  const params = new URLSearchParams({ practiceId });
  const res = await authFetch(`${base(linkId)}?${params}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createPracticeErezept(linkId, practiceId, payload) {
  const res = await authFetch(`${base(linkId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, practiceId }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function updatePracticeErezept(linkId, practiceId, id, payload) {
  const params = new URLSearchParams({ practiceId });
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(id)}?${params}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, practiceId }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deletePracticeErezept(linkId, practiceId, id) {
  const params = new URLSearchParams({ practiceId });
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(id)}?${params}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
