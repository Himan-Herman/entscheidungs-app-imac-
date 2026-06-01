import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/anamnesis";

function qs(practiceId) {
  return `?practiceId=${encodeURIComponent(practiceId)}`;
}

export async function fetchAnamnesisSubmissions(practiceId, templateId) {
  const res = await authFetch(`${BASE}/templates/${encodeURIComponent(templateId)}/submissions${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchAnamnesisSubmission(practiceId, submissionId) {
  const res = await authFetch(`${BASE}/submissions/${encodeURIComponent(submissionId)}${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchAnamnesisSubmission(practiceId, submissionId, body) {
  const res = await authFetch(`${BASE}/submissions/${encodeURIComponent(submissionId)}${qs(practiceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteAnamnesisSubmission(practiceId, submissionId) {
  const res = await authFetch(`${BASE}/submissions/${encodeURIComponent(submissionId)}${qs(practiceId)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
