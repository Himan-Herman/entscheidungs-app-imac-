import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/activity";

export async function fetchPatientActivity(params = {}) {
  const q = new URLSearchParams();
  if (params.type) q.set("type", params.type);
  if (params.q) q.set("q", params.q);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.linkId) q.set("linkId", params.linkId);
  const suffix = q.toString() ? `?${q}` : "";
  const res = await authFetch(`${BASE}${suffix}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPatientActivityAiSummary(body = {}) {
  const res = await authFetch(`${BASE}/ai-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
