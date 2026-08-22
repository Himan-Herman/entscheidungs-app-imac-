import { authFetch } from "../../../api/authFetch.js";

/**
 * Video consultations of ONE care relationship. The link is the only scope.
 *
 * Deliberately NOT the cross-practice endpoint with client-side filtering: that
 * one answers with every practice's sessions.
 */
function base(linkId) {
  return `/api/patient/practice/${encodeURIComponent(linkId)}/telemedicine`;
}

export async function fetchScopedSessions(linkId, { signal } = {}) {
  const res = await authFetch(base(linkId), { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchScopedSession(linkId, sessionId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(sessionId)}`, { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function grantScopedConsent(linkId, sessionId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(sessionId)}/consent`, {
    method: "POST",
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Enters the waiting room. This is the ONLY call that returns a meeting URL —
 * the list deliberately carries nothing that could reconstruct one.
 */
export async function joinScopedSession(linkId, sessionId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(sessionId)}/join`, {
    method: "PATCH",
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function leaveScopedSession(linkId, sessionId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(sessionId)}/leave`, {
    method: "PATCH",
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
