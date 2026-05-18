import { authFetch } from "../../../api/authFetch.js";

function qPractice(practiceId) {
  return new URLSearchParams({ practiceId }).toString();
}

function messagesBase(linkId) {
  return `/api/practice/patients/${encodeURIComponent(linkId)}/messages`;
}

export async function fetchPracticeThreads(linkId, practiceId) {
  const res = await authFetch(
    `${messagesBase(linkId)}?${qPractice(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createPracticeThread(linkId, practiceId, payload) {
  const res = await authFetch(
    `${messagesBase(linkId)}?${qPractice(practiceId)}`,
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
    `${messagesBase(linkId)}/${encodeURIComponent(threadId)}?${qPractice(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function sendPracticeThreadMessage(linkId, practiceId, threadId, body) {
  const res = await authFetch(
    `${messagesBase(linkId)}/${encodeURIComponent(threadId)}/messages?${qPractice(practiceId)}`,
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
    `${messagesBase(linkId)}/${encodeURIComponent(threadId)}/close?${qPractice(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function archivePracticeThread(linkId, practiceId, threadId) {
  const res = await authFetch(
    `${messagesBase(linkId)}/${encodeURIComponent(threadId)}/archive?${qPractice(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeThreadAiDraft(
  linkId,
  practiceId,
  threadId,
  { locale, draftInput, mode } = {},
) {
  const res = await authFetch(
    `${messagesBase(linkId)}/${encodeURIComponent(threadId)}/ai-reply-draft?${qPractice(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, draftInput, mode }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
