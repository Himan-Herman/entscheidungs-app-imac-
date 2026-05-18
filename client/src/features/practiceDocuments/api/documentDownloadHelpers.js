import { getAuthHeaders } from "../../../api/authHeaders.js";

/**
 * @param {string} url
 * @param {{ disposition?: 'inline' | 'attachment', fileName?: string }} [opts]
 */
export async function fetchAuthenticatedFileBlob(url, opts = {}) {
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (res.status === 403) throw new Error("forbidden");
  if (res.status === 410) {
    const data = await res.json().catch(() => ({}));
    if (data.error === "link_expired") throw new Error("link_expired");
    if (data.error === "link_revoked") throw new Error("link_revoked");
    throw new Error("document_unavailable");
  }
  if (!res.ok) throw new Error("download_failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  if (opts.disposition === "inline") {
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = opts.fileName || "document";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
