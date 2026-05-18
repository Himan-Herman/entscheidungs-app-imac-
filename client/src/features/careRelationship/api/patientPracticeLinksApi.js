import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/practice-links";

export async function fetchPatientPracticeLinks(params = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  const suffix = q.toString() ? `?${q}` : "";
  const res = await authFetch(`${BASE}${suffix}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchPatientProfileAccess(linkId, granted) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(linkId)}/profile-access`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ granted }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
