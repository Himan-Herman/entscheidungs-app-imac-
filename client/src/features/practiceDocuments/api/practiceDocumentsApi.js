import { authFetch } from "../../../api/authFetch.js";
import { fetchAuthenticatedFileBlob } from "./documentDownloadHelpers.js";

function qPractice(practiceId) {
  return new URLSearchParams({ practiceId }).toString();
}

function base(linkId) {
  return `/api/practice/patients/${encodeURIComponent(linkId)}/documents`;
}

export async function fetchPracticeDocuments(linkId, practiceId, { includeArchived = false } = {}) {
  const qs = new URLSearchParams({ practiceId });
  if (includeArchived) qs.set("includeArchived", "true");
  const res = await authFetch(`${base(linkId)}?${qs.toString()}`);
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

export async function restorePracticeDocument(linkId, practiceId, documentId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}/restore?${qPractice(practiceId)}`,
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

export async function fetchPracticeDocumentAiOrganize(linkId, practiceId, documentId, { locale } = {}) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}/ai-organize?${qPractice(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function viewPracticeDocumentFile(linkId, practiceId, documentId, fileId, fileName) {
  const url = `${base(linkId)}/${encodeURIComponent(documentId)}/download?${qPractice(practiceId)}&fileId=${encodeURIComponent(fileId)}&disposition=inline`;
  await fetchAuthenticatedFileBlob(url, { disposition: "inline", fileName });
}

export async function downloadPracticeDocumentFile(linkId, practiceId, documentId, fileId, fileName) {
  const url = `${base(linkId)}/${encodeURIComponent(documentId)}/download?${qPractice(practiceId)}&fileId=${encodeURIComponent(fileId)}`;
  await fetchAuthenticatedFileBlob(url, { fileName: fileName || "document" });
}

export async function createPracticeDocumentSecureLink(linkId, practiceId, documentId, fileId) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(documentId)}/download-link?${qPractice(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeDocumentSecureLinks(practiceId, documentId) {
  const q = new URLSearchParams({ practiceId, documentId });
  const res = await authFetch(`/api/practice/documents/secure-links?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function revokePracticeDocumentSecureLink(practiceId, tokenId) {
  const res = await authFetch(
    `/api/practice/documents/secure-links/${encodeURIComponent(tokenId)}/revoke?practiceId=${encodeURIComponent(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeDocumentAiTitleDraft(
  linkId,
  practiceId,
  { type, title, description, locale } = {},
) {
  const res = await authFetch(
    `${base(linkId)}/ai-title-draft?${qPractice(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, title, description, locale }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
