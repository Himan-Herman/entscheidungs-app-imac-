import { authFetch } from "../../../api/authFetch.js";

function qPractice(practiceId) {
  return new URLSearchParams({ practiceId }).toString();
}

export async function fetchPracticeThreads(linkId, practiceId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/threads?${qPractice(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createPracticeThread(linkId, practiceId, payload) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/threads?${qPractice(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeThread(linkId, practiceId, threadId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/threads/${encodeURIComponent(threadId)}?${qPractice(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function sendPracticeThreadMessage(linkId, practiceId, threadId, body) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/threads/${encodeURIComponent(threadId)}/messages?${qPractice(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function closePracticeThread(linkId, practiceId, threadId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/threads/${encodeURIComponent(threadId)}/close?${qPractice(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function archivePracticeThread(linkId, practiceId, threadId) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/threads/${encodeURIComponent(threadId)}/archive?${qPractice(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
