import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/vitals";

export async function fetchVitals({ type, limit } = {}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  const res = await authFetch(`${BASE}${qs ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createVital(payload) {
  const res = await authFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function updateVital(id, payload) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteVital(id) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
