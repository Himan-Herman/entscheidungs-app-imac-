import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/sos-card";

export async function fetchSosCard() {
  const res = await authFetch(BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function saveSosCard(payload) {
  const res = await authFetch(BASE, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function generateToken() {
  const res = await authFetch(`${BASE}/generate-token`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function revokeToken() {
  const res = await authFetch(`${BASE}/revoke-token`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function generateAiSummary() {
  const res = await authFetch(`${BASE}/ai-summary`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPublicEmergency(token) {
  const res = await fetch(`/api/public/emergency/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
