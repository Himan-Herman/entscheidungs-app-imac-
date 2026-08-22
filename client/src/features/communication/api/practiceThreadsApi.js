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

/**
 * Explicit read acknowledgement.
 *
 * The server's GET is read-only, so fetching a thread no longer marks it read.
 * Callers acknowledge once the conversation has actually been presented. The
 * endpoint is idempotent, so a repeated call is harmless.
 */
export async function acknowledgePracticeThreadRead(linkId, practiceId, threadId) {
  const res = await authFetch(
    `${messagesBase(linkId)}/${encodeURIComponent(threadId)}/read?${qPractice(practiceId)}`,
    { method: "PATCH" },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function sendPracticeThreadMessage(linkId, practiceId, threadId, body, clientRequestId) {
  const res = await authFetch(
    `${messagesBase(linkId)}/${encodeURIComponent(threadId)}/messages?${qPractice(practiceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, clientRequestId }),
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
