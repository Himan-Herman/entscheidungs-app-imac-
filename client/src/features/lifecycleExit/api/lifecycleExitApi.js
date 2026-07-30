import { authFetch } from "../../../api/authFetch.js";

/**
 * Server-side confirmation constant of DELETE /api/account/delete. The
 * user-visible, localized confirmation phrase is validated client-side; this
 * stable API constant is what the server checks.
 */
export const ACCOUNT_DELETE_API_CONFIRMATION = "DELETE_MY_MEDSCOUTX_DATA";

export async function fetchPracticeLifecycle(practiceId) {
  const res = await authFetch(
    `/api/practices/${encodeURIComponent(practiceId)}/lifecycle`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * @param {string} practiceId
 * @param {"suspend"|"reactivate"|"close"|"request-reactivation"|"request-deletion"} action
 * @param {{ password: string, reason?: string }} body
 */
export async function postPracticeLifecycleAction(practiceId, action, body) {
  const res = await authFetch(
    `/api/practices/${encodeURIComponent(practiceId)}/lifecycle/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteAccount() {
  const res = await authFetch("/api/account/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: ACCOUNT_DELETE_API_CONFIRMATION }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
