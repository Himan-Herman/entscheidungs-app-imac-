import { authFetch } from "../../../api/authFetch.js";

/**
 * @param {{ status?: string, limit?: number, offset?: number }} [opts]
 */
export async function fetchPatientInbox(opts = {}) {
  const q = new URLSearchParams();
  if (opts.status) q.set("status", opts.status);
  if (opts.limit != null) q.set("limit", String(opts.limit));
  if (opts.offset != null) q.set("offset", String(opts.offset));
  const query = q.toString();
  const res = await authFetch(`/api/patient/inbox${query ? `?${query}` : ""}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * @param {string} itemId
 */
export async function markPatientInboxRead(itemId) {
  const res = await authFetch(
    `/api/patient/inbox/${encodeURIComponent(itemId)}/read`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * @param {string} itemId
 */
export async function archivePatientInboxItem(itemId) {
  const res = await authFetch(
    `/api/patient/inbox/${encodeURIComponent(itemId)}/archive`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
