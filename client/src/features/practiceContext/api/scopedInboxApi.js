import { authFetch } from "../../../api/authFetch.js";

/**
 * Inbox notices of ONE care relationship. The link is the only scope.
 *
 * Deliberately NOT the cross-practice endpoint with client-side filtering: that
 * one answers with every practice's notices, so filtering here would mean the
 * other relationships' data had already been transmitted to this device.
 */
function base(linkId) {
  return `/api/patient/practice/${encodeURIComponent(linkId)}/inbox`;
}

export async function fetchScopedInbox(linkId, { status, signal } = {}) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await authFetch(`${base(linkId)}${query}`, { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Explicit acknowledgement — reading the list never marks anything. */
export async function markScopedInboxRead(linkId, itemId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(itemId)}/read`, {
    method: "PATCH",
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function archiveScopedInboxItem(linkId, itemId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(itemId)}/archive`, {
    method: "PATCH",
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function restoreScopedInboxItem(linkId, itemId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(itemId)}/restore`, {
    method: "PATCH",
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
