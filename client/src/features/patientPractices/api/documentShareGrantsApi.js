import { authFetch } from "../../../api/authFetch.js";

export { shareErrorMessage } from "../lib/shareErrorMessage.js";

/**
 * Patient-controlled document releases.
 *
 * The client holds no authorization logic. It sends the one field the server
 * accepts — the target link id — and nothing else: source practice, target
 * practice, status and granting user are all derived server-side, and sending
 * any of them is rejected with 400 unsupported_field.
 */

/**
 * @param {string} documentId
 * @param {string} targetPracticePatientLinkId the patient's own link to the receiving practice
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function createDocumentShareGrant(documentId, targetPracticePatientLinkId, opts = {}) {
  const res = await authFetch(
    `/api/patient/practice-documents/${encodeURIComponent(documentId)}/share-grants`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Exactly one field. No practice id, no status, no timestamps.
      body: JSON.stringify({ targetPracticePatientLinkId }),
      signal: opts.signal,
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** @param {{ signal?: AbortSignal }} [opts] */
export async function fetchDocumentShareGrants(opts = {}) {
  const res = await authFetch("/api/patient/document-share-grants", { signal: opts.signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * @param {string} grantId
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function revokeDocumentShareGrant(grantId, opts = {}) {
  const res = await authFetch(
    `/api/patient/document-share-grants/${encodeURIComponent(grantId)}/revoke`,
    { method: "POST", signal: opts.signal },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
