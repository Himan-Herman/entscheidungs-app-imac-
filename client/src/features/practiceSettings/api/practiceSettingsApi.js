import { authFetch } from "../../../api/authFetch.js";

export async function fetchPracticeSettings(practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`/api/practice/settings?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchPracticeSettings(practiceId, body) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`/api/practice/settings?${q}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function uploadPracticeLogo(practiceId, file) {
  const q = new URLSearchParams({ practiceId });
  const form = new FormData();
  form.append("logo", file);
  const res = await authFetch(`/api/practice/settings/logo?${q}`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deletePracticeLogo(practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`/api/practice/settings/logo?${q}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPracticeDescriptionAiDraft(practiceId, body) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`/api/practice/settings/ai-description-draft?${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Fetch logo as blob URL for authenticated <img> display. Caller should revokeObjectURL when done. */
export async function fetchPracticeLogoBlobUrl(logoPath) {
  if (!logoPath || !String(logoPath).startsWith("/api/")) return null;
  const res = await authFetch(logoPath);
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
