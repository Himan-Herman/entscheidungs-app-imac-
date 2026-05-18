import { authFetch } from "../../../api/authFetch.js";

function qPractice(practiceId) {
  return new URLSearchParams({ practiceId }).toString();
}

function base(linkId) {
  return `/api/practice/patients/${encodeURIComponent(linkId)}/documents`;
}

export async function fetchPracticeDocuments(linkId, practiceId) {
  const res = await authFetch(`${base(linkId)}?${qPractice(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createPracticeDocument(linkId, practiceId, payload) {
  const res = await authFetch(`${base(linkId)}?${qPractice(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function updatePracticeDocumentDraft(linkId, practiceId, documentId, payload) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}?${qPractice(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeDocument(linkId, practiceId, documentId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}?${qPractice(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function uploadPracticeDocumentFile(linkId, practiceId, documentId, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}/files?${qPractice(practiceId)}`,
    { method: "POST", body: form },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function sharePracticeDocument(linkId, practiceId, documentId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}/share?${qPractice(practiceId)}`,
    { method: "POST" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function revokePracticeDocumentShare(linkId, practiceId, documentId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}/revoke?${qPractice(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function archivePracticeDocument(linkId, practiceId, documentId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}/archive?${qPractice(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deletePracticeDocument(linkId, practiceId, documentId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}/delete?${qPractice(practiceId)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
