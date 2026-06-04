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
