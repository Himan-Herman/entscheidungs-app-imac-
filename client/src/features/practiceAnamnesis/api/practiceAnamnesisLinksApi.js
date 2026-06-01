import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/anamnesis";

function qs(practiceId) {
  return `?practiceId=${encodeURIComponent(practiceId)}`;
}

export async function fetchAnamnesisLinks(practiceId, templateId) {
  const res = await authFetch(`${BASE}/templates/${encodeURIComponent(templateId)}/links${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createAnamnesisLink(practiceId, templateId, body) {
  const res = await authFetch(`${BASE}/templates/${encodeURIComponent(templateId)}/links${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchAnamnesisLink(practiceId, templateId, linkId, body) {
  const res = await authFetch(
    `${BASE}/templates/${encodeURIComponent(templateId)}/links/${encodeURIComponent(linkId)}${qs(practiceId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteAnamnesisLink(practiceId, templateId, linkId) {
  const res = await authFetch(
    `${BASE}/templates/${encodeURIComponent(templateId)}/links/${encodeURIComponent(linkId)}${qs(practiceId)}`,
    { method: "DELETE" }
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
