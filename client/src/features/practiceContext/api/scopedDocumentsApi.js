import { authFetch } from "../../../api/authFetch.js";

/**
 * Documents of ONE care relationship. The link is the only scope — no
 * practiceId, documentId or token is ever sent as proof of anything.
 */
function base(linkId) {
  return `/api/patient/practice/${encodeURIComponent(linkId)}/documents`;
}

export async function fetchScopedDocuments(linkId, { signal } = {}) {
  const res = await authFetch(base(linkId), { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Downloads a file of this context.
 *
 * Deliberately NOT a secure-link round trip: the server re-derives access from
 * session + link on this very request, so a share revoked a second ago blocks
 * the download even though the list still shows the document. Nothing
 * replayable is handed to the browser.
 */
export async function downloadScopedDocumentFile(linkId, documentId, fileId, { signal } = {}) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}/files/${encodeURIComponent(fileId)}/download`,
    { signal },
  );
  if (!res.ok) return { res, blob: null };
  const blob = await res.blob();
  return { res, blob };
}
