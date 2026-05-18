import { authFetch } from "../../../api/authFetch.js";
import { getAuthHeaders } from "../../../api/authHeaders.js";

export async function fetchPatientPracticeDocuments() {
  const res = await authFetch("/api/patient/practice-documents");
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientPracticeDocument(documentId) {
  const res = await authFetch(
    `/api/patient/practice-documents/${encodeURIComponent(documentId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Opens download in a new tab using authenticated fetch + blob URL.
 */
export async function downloadPatientPracticeDocumentFile(documentId, fileId, fileName) {
  const url = `/api/patient/practice-documents/${encodeURIComponent(documentId)}/download?fileId=${encodeURIComponent(fileId)}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (res.status === 410) throw new Error("document_unavailable");
  if (!res.ok) throw new Error("download_failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName || "document";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function submitPatientPracticeDocumentQuestion(documentId) {
  const res = await authFetch(
    `/api/patient/practice-documents/${encodeURIComponent(documentId)}/question`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
