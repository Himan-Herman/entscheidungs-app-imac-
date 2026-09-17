import { authFetch } from "../../../api/authFetch.js";

/** All communication calls of ONE care relationship. The link is the only scope. */
function base(linkId) {
  return `/api/patient/practice/${encodeURIComponent(linkId)}/thread`;
}

/**
 * Reads the channel of one relationship.
 *
 * Takes the AbortSignal from useScopedRequest so a switch can cancel the request
 * in flight; the caller additionally discards any response that still arrives
 * for a context that is no longer active.
 *
 * @param {string} linkId
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchScopedChannel(linkId, { signal } = {}) {
  const res = await authFetch(base(linkId), { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Explicit read acknowledgement — the GET stays free of side effects.
 *
 * `throughMessageId` names the last message actually displayed. Only messages
 * up to that point are acknowledged, so anything that arrives while the request
 * is in flight stays unread.
 */
export async function acknowledgeScopedChannelRead(linkId, throughMessageId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ throughMessageId }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * One page of older history.
 *
 * `before` is the OLDEST message already held; the page returned is the one
 * immediately older than it. Cursor rather than offset, because the
 * conversation grows at the other end while it is being read.
 */
export async function fetchScopedOlderMessages(linkId, before, { signal } = {}) {
  const res = await authFetch(
    `${base(linkId)}/messages?before=${encodeURIComponent(before)}`,
    { signal },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Sends into the existing channel of this relationship.
 * `clientRequestId` carries the Phase 2A.1 idempotency key.
 */
export async function sendScopedMessage(linkId, body, clientRequestId, { signal } = {}) {
  const res = await authFetch(`${base(linkId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, clientRequestId }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Replaces the text of one's own message.
 *
 * The text travels in the body. The server decides — in one conditional
 * update — whether the message may still be changed, so a 409 here is a normal
 * answer and not a failure of the client.
 */
export async function editScopedMessage(linkId, messageId, body, { signal } = {}) {
  const res = await authFetch(
    `${base(linkId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
      signal,
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Withdraws one's own message. The message stays; its content does not. */
export async function withdrawScopedMessage(linkId, messageId, { signal } = {}) {
  const res = await authFetch(
    `${base(linkId)}/messages/${encodeURIComponent(messageId)}/withdraw`,
    { method: "PATCH", signal },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Asks for ONE message in another rendering.
 *
 * `mode` chooses which: a faithful translation, or the same message in plainer
 * words. Both are produced from the ORIGINAL — the client never asks for one to
 * be derived from the other.
 *
 * A POST because it may cause external processing and stores its result — but
 * it changes nothing about the conversation: no read state, no ordering, no
 * timestamps. Everything travels in the body, like every other request content
 * in this API.
 */
export async function translateScopedMessage(
  linkId,
  messageId,
  targetLanguage,
  { mode = "normal", signal } = {},
) {
  const res = await authFetch(
    `${base(linkId)}/messages/${encodeURIComponent(messageId)}/translation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage, mode }),
      signal,
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Sends one short recording and gets a draft back.
 *
 * Multipart, because the payload is audio. Nothing accompanies it but an
 * optional language hint — no thread, no message, no identities: the server
 * knows which relationship this is from the URL and from the session, and the
 * recording itself needs no context to be recognised.
 */
export async function transcribeScopedDictation(linkId, blob, language, { signal } = {}) {
  const form = new FormData();
  form.append("audio", blob, "dictation");
  if (language) form.append("language", language);

  // No Content-Type header: the browser has to set the multipart boundary.
  const res = await authFetch(`${base(linkId)}/dictation`, {
    method: "POST",
    body: form,
    signal,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
