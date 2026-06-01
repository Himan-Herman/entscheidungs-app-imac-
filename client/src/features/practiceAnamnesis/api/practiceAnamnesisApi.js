import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/anamnesis";

function qs(practiceId) {
  return `?practiceId=${encodeURIComponent(practiceId)}`;
}

export async function fetchAnamnesisTemplates(practiceId) {
  const res = await authFetch(`${BASE}/templates${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchAnamnesisTemplate(practiceId, templateId) {
  const res = await authFetch(`${BASE}/templates/${encodeURIComponent(templateId)}${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createAnamnesisTemplate(practiceId, body) {
  const res = await authFetch(`${BASE}/templates${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createAnamnesisTemplateFromStandard(practiceId) {
  const res = await authFetch(`${BASE}/templates/from-standard${qs(practiceId)}`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Full replacement — replaces all sections+questions atomically. */
export async function putFullAnamnesisTemplate(practiceId, templateId, body) {
  const res = await authFetch(`${BASE}/templates/${encodeURIComponent(templateId)}${qs(practiceId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchAnamnesisTemplate(practiceId, templateId, body) {
  const res = await authFetch(`${BASE}/templates/${encodeURIComponent(templateId)}${qs(practiceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteAnamnesisTemplate(practiceId, templateId) {
  const res = await authFetch(`${BASE}/templates/${encodeURIComponent(templateId)}${qs(practiceId)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
