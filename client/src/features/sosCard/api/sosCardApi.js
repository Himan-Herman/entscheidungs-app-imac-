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

const WALLET_BASE = "/api/sos/wallet";

/** Which wallet integrations are configured server-side. */
export async function fetchWalletStatus() {
  const res = await authFetch(`${WALLET_BASE}/status`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Request the Add-to-Google-Wallet link (available once configured server-side). */
export async function requestGoogleWalletLink() {
  const res = await authFetch(`${WALLET_BASE}/google-link`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Request the signed .pkpass file (available once configured server-side).
 * Returns the raw Response so the caller can read the binary blob on success
 * or a JSON error on failure.
 */
export async function requestApplePass() {
  return authFetch(`${WALLET_BASE}/apple-pass`, { method: "POST" });
}
