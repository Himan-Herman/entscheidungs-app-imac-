import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/messages";

export async function fetchPatientThreads() {
  const res = await authFetch(BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientThread(threadId) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(threadId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function sendPatientThreadMessage(threadId, body) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(threadId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function archivePatientThread(threadId) {
  const res = await authFetch(
    `${BASE}/${encodeURIComponent(threadId)}/archive`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientThreadAiRewrite(
  threadId,
  { locale, draftInput, mode } = {},
) {
  const res = await authFetch(
    `${BASE}/${encodeURIComponent(threadId)}/ai-rewrite`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, draftInput, mode }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
