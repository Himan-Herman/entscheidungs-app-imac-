import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/erezept";

export async function fetchErezept() {
  const res = await authFetch(BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function updateErezeptStatus(id, status) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
