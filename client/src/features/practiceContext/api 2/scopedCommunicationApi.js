import { authFetch } from "../../../api/authFetch.js";

/** All communication calls of ONE care relationship. The link is the only scope. */
function base(linkId) {
  return `/api/patient/practice/${encodeURIComponent(linkId)}/thread`;
}

/**
 * Reads the channel of one relationship.
 *
 * Takes the AbortSignal from useScopedRequest so a switch can cancel the request
 * in flight; the caller additionally discards any response that still arrives
 * for a context that is no longer active.
 *
 * @param {string} linkId
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchScopedChannel(linkId, { signal } = {}) {
  const res = await authFetch(base(linkId), { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Explicit read acknowledgement — the GET stays free of side effects. */
export async function acknowledgeScopedChannelRead(linkId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/read`, { method: "PATCH", signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Sends into the existing channel of this relationship.
 * `clientRequestId` carries the Phase 2A.1 idempotency key.
 */
export async function sendScopedMessage(linkId, body, clientRequestId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, clientRequestId }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
