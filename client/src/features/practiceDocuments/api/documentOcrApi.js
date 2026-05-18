import { authFetch } from "../../../api/authFetch.js";

export async function startDocumentOcr(linkId, practiceId, documentId, fileId) {
  const url = `/api/practice/patients/${encodeURIComponent(linkId)}/documents/${encodeURIComponent(documentId)}/ocr/start?practiceId=${encodeURIComponent(practiceId)}`;
  const res = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchDocumentOcrStatus(linkId, practiceId, documentId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/documents/${encodeURIComponent(documentId)}/ocr/status?practiceId=${encodeURIComponent(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchDocumentOcrResult(linkId, practiceId, documentId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/documents/${encodeURIComponent(documentId)}/ocr/result?practiceId=${encodeURIComponent(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchDocumentOcrResult(linkId, practiceId, documentId, body) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/documents/${encodeURIComponent(documentId)}/ocr/result?practiceId=${encodeURIComponent(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function shareDocumentOcrResult(linkId, practiceId, documentId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/documents/${encodeURIComponent(documentId)}/ocr/share?practiceId=${encodeURIComponent(practiceId)}`,
    { method: "POST" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function discardDocumentOcrResult(linkId, practiceId, documentId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/documents/${encodeURIComponent(documentId)}/ocr/discard?practiceId=${encodeURIComponent(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientStructuredDocument(documentId) {
  const res = await authFetch(
    `/api/patient/practice-documents/${encodeURIComponent(documentId)}/structured`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
