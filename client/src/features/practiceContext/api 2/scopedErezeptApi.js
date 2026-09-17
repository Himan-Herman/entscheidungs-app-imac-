import { authFetch } from "../../../api/authFetch.js";

/**
 * e-Prescriptions of ONE care relationship. The link is the only scope.
 *
 * Deliberately NOT the cross-practice endpoint with client-side filtering:
 * that one answers with every practice's prescriptions, so filtering here would
 * mean the other relationships' medication data had already been transmitted.
 */
function base(linkId) {
  return `/api/patient/practice/${encodeURIComponent(linkId)}/erezept`;
}

export async function fetchScopedErezept(linkId, { signal } = {}) {
  const res = await authFetch(base(linkId), { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Marks a prescription at_pharmacy or redeemed — the patient's existing right. */
export async function updateScopedErezeptStatus(linkId, entryId, status, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/${encodeURIComponent(entryId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
