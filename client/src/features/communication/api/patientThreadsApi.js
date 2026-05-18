import { authFetch } from "../../../api/authFetch.js";

export async function fetchPatientThreads() {
  const res = await authFetch("/api/patient/threads");
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientThread(threadId) {
  const res = await authFetch(
    `/api/patient/threads/${encodeURIComponent(threadId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function sendPatientThreadMessage(threadId, body) {
  const res = await authFetch(
    `/api/patient/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function archivePatientThread(threadId) {
  const res = await authFetch(
    `/api/patient/threads/${encodeURIComponent(threadId)}/archive`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
