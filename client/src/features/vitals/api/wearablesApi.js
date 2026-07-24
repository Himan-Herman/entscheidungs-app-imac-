import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/wearables";

/** Static provider catalog. Returns { res, data:{ ok, providers } }. */
export async function fetchWearableProviders() {
  const res = await authFetch(`${BASE}/providers`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** This patient's connections. Returns { res, data:{ ok, connections } }. */
export async function fetchWearableConnections() {
  const res = await authFetch(`${BASE}/connections`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Connect (or re-activate) a provider with explicit consent. */
export async function connectWearable({ provider, scopes, consentAccepted }) {
  const res = await authFetch(`${BASE}/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, scopes, consentAccepted }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Soft-disconnect a connection (stops future imports; keeps existing measurements). */
export async function disconnectWearable(id) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}/disconnect`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
