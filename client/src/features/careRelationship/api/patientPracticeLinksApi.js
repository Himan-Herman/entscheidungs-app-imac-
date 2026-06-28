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

/**
 * Incoming practice-initiated link requests (Fall A).
 * Accept = grant consent for the chosen scopes (flips invited → active). Decline = mark the
 * pending request declined. No data flows before acceptance.
 */
export async function acceptPatientLinkRequest(linkId, scopes) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(linkId)}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scopes: Array.isArray(scopes) ? scopes : [] }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function declinePatientLinkRequest(linkId) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(linkId)}/decline`, {
    method: "PATCH",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Patient-generated practice connection code (Phase 2 UI).
 * The plaintext `code` in the create response is shown ONCE — never persisted client-side
 * and never logged.
 */

/** Generate a fresh connection code with the chosen consent scopes. */
export async function createPatientConnectCode(scopes) {
  const res = await authFetch(`${BASE}/connect-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scopes: Array.isArray(scopes) ? scopes : [] }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Metadata for the patient's active code (never the plaintext). */
export async function fetchPatientConnectCode() {
  const res = await authFetch(`${BASE}/connect-code`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Revoke an active code by id. */
export async function revokePatientConnectCode(codeId) {
  const res = await authFetch(`${BASE}/connect-code/${encodeURIComponent(codeId)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
