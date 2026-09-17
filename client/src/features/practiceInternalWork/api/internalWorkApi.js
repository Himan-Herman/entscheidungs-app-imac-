import { authFetch } from "../../../api/authFetch.js";

/**
 * Practice-internal notes and reminders on one care link.
 *
 * There is no patient counterpart to this file on purpose: the patient app has
 * no client for these endpoints, just as the server has no patient route.
 */
const base = (linkId) => `/api/practice/patients/${encodeURIComponent(linkId)}`;

async function call(url, init) {
  const res = await authFetch(url, init);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const fetchInternalNotes = (linkId, practiceId) =>
  call(`${base(linkId)}/internal-notes?practiceId=${encodeURIComponent(practiceId)}`);

export const createInternalNote = (linkId, practiceId, body) =>
  call(`${base(linkId)}/internal-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId, body }),
  });

export const updateInternalNote = (linkId, practiceId, noteId, body) =>
  call(`${base(linkId)}/internal-notes/${encodeURIComponent(noteId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId, body }),
  });

export const fetchReminders = (linkId, practiceId, status = "all") =>
  call(`${base(linkId)}/reminders?practiceId=${encodeURIComponent(practiceId)}&status=${status}`);

export const createReminder = (linkId, practiceId, payload) =>
  call(`${base(linkId)}/reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId, ...payload }),
  });

export const completeReminder = (linkId, practiceId, reminderId) =>
  call(`${base(linkId)}/reminders/${encodeURIComponent(reminderId)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId }),
  });
