import { authFetch } from "../../../api/authFetch.js";
import {
  isPatientInboxClientEnabled,
  notePatientInboxDisabledResponse,
} from "../featureFlag.js";

/**
 * @param {{ status?: string, type?: string, limit?: number, offset?: number }} [opts]
 */
export async function fetchPatientInbox(opts = {}) {
  const q = new URLSearchParams();
  if (opts.status) q.set("status", opts.status);
  if (opts.type) q.set("type", opts.type);
  if (opts.limit != null) q.set("limit", String(opts.limit));
  if (opts.offset != null) q.set("offset", String(opts.offset));
  const query = q.toString();
  const res = await authFetch(`/api/patient/inbox${query ? `?${query}` : ""}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientInboxCount() {
  if (!isPatientInboxClientEnabled()) {
    return { res: new Response(null, { status: 204 }), data: { ok: true, unreadCount: 0 } };
  }
  const res = await authFetch("/api/patient/inbox/count");
  const data = await res.json().catch(() => ({}));
  notePatientInboxDisabledResponse(res, data);
  return { res, data };
}

export async function postPatientInboxAiSummary(locale) {
  const res = await authFetch("/api/patient/inbox/ai-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
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
