import { authFetch } from "../../../api/authFetch.js";
import { fetchAuthenticatedFileBlob } from "./documentDownloadHelpers.js";

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

export async function viewPatientPracticeDocumentFile(documentId, fileId, fileName) {
  const url = `/api/patient/practice-documents/${encodeURIComponent(documentId)}/download?fileId=${encodeURIComponent(fileId)}&disposition=inline`;
  await fetchAuthenticatedFileBlob(url, { disposition: "inline", fileName });
}

export async function downloadPatientPracticeDocumentFile(documentId, fileId, fileName) {
  const url = `/api/patient/practice-documents/${encodeURIComponent(documentId)}/download?fileId=${encodeURIComponent(fileId)}`;
  await fetchAuthenticatedFileBlob(url, { fileName: fileName || "document" });
}

export async function createPatientPracticeDocumentDownloadLink(documentId, fileId) {
  const res = await authFetch(
    `/api/patient/practice-documents/${encodeURIComponent(documentId)}/download-link`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function submitPatientPracticeDocumentQuestion(documentId) {
  const res = await authFetch(
    `/api/patient/practice-documents/${encodeURIComponent(documentId)}/question`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
