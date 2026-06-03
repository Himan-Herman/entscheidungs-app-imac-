import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/booking";

function qs(practiceId) {
  return `?practiceId=${encodeURIComponent(practiceId)}`;
}

export async function fetchBookingSettings(practiceId) {
  const res = await authFetch(`${BASE}/settings${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchBookingSettings(practiceId, body) {
  const res = await authFetch(`${BASE}/settings${qs(practiceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchBookingRequests(practiceId, query = {}) {
  const params = new URLSearchParams({ practiceId });
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const res = await authFetch(`${BASE}/requests?${params}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function acceptBookingRequest(practiceId, appointmentId, body) {
  const res = await authFetch(
    `${BASE}/requests/${encodeURIComponent(appointmentId)}/accept${qs(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function declineBookingRequest(practiceId, appointmentId, body) {
  const res = await authFetch(
    `${BASE}/requests/${encodeURIComponent(appointmentId)}/decline${qs(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
