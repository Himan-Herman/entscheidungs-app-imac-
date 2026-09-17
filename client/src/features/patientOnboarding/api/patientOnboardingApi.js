/**
 * Practice-side calls for local patient records and their invitations.
 *
 * Every response the practice sees is already minimal on the server; nothing is
 * enriched here. The plaintext token comes back exactly once, from
 * `createInvitation`, and is never stored — it goes straight into the link the
 * practice hands over.
 */
import { authFetch } from "../../../api/authFetch.js";

/** Turn a non-ok response into the server's own error code, never a guess. */
async function unwrap(res) {
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* an empty or non-JSON body stays an empty object */
  }
  if (!res.ok || body?.ok === false) {
    const err = new Error(body?.error || `request_failed_${res.status}`);
    err.status = res.status;
    err.code = body?.error || null;
    throw err;
  }
  return body;
}

/**
 * @param {string} practiceId
 * @param {{ q?: string, status?: string, includeArchived?: boolean, limit?: number, offset?: number }} [opts]
 */
export async function fetchPatientEntries(practiceId, opts = {}) {
  const q = new URLSearchParams({ practiceId });
  if (opts.q) q.set("q", opts.q);
  if (opts.status) q.set("status", opts.status);
  if (opts.includeArchived) q.set("includeArchived", "true");
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.offset) q.set("offset", String(opts.offset));
  return unwrap(await authFetch(`/api/practice/patient-entries?${q.toString()}`));
}

/**
 * Create a local record. Creates nothing else — no invitation, no link.
 * @param {string} practiceId
 * @param {{ givenName: string, familyName: string, dateOfBirth?: string|null,
 *           email?: string|null, phone?: string|null, practiceRecordNumber?: string|null }} data
 */
export async function createPatientEntry(practiceId, data) {
  return unwrap(await authFetch("/api/practice/patient-entries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ practiceId, ...data }),
  }));
}

/** @param {string} practiceId @param {string} entryId */
export async function fetchEntryInvitations(practiceId, entryId) {
  const q = new URLSearchParams({ practiceId });
  return unwrap(await authFetch(
    `/api/practice/patient-entries/${encodeURIComponent(entryId)}/invitations?${q}`,
  ));
}

/**
 * Issue an invitation. Also the "send again" path: the server supersedes any
 * existing one in the same transaction, so there is no separate call and no
 * chance of two live credentials.
 *
 * The returned `token` is the ONLY time the plaintext exists. Keep it in memory,
 * put it straight into the link, and never persist it.
 */
export async function createInvitation(practiceId, entryId) {
  return unwrap(await authFetch(
    `/api/practice/patient-entries/${encodeURIComponent(entryId)}/invitations`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ practiceId }),
    },
  ));
}

/**
 * Issue an invitation and have the SERVER email it to the address on the entry.
 *
 * Deliberately not "create, then send the token back": the plaintext credential
 * never reaches this browser at all. The response carries only a masked address,
 * so the practice can confirm where it went without the token ever existing on
 * the client.
 *
 * @param {string} practiceId @param {string} entryId @param {string} locale
 */
export async function sendInvitationEmail(practiceId, entryId, locale) {
  return unwrap(await authFetch(
    `/api/practice/patient-entries/${encodeURIComponent(entryId)}/invitations/send-email`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ practiceId, locale }),
    },
  ));
}

/** @param {string} practiceId @param {string} invitationId */
export async function revokeInvitation(practiceId, invitationId) {
  return unwrap(await authFetch(
    `/api/practice/patient-invitations/${encodeURIComponent(invitationId)}/revoke`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ practiceId }),
    },
  ));
}

/**
 * Issue a fresh on-site code on the SAME invitation. It does not create a new
 * invitation and does not move the seven-day expiry; the previous code stops
 * working immediately. Plaintext returned once, shown once, never stored.
 */
export async function rotateManualCode(practiceId, invitationId) {
  return unwrap(await authFetch(
    `/api/practice/patient-invitations/${encodeURIComponent(invitationId)}/manual-code`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ practiceId }),
    },
  ));
}

/** Archiving keeps the record and ends any live invitation. There is no delete. */
export async function archivePatientEntry(practiceId, entryId) {
  return unwrap(await authFetch(
    `/api/practice/patient-entries/${encodeURIComponent(entryId)}/archive`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ practiceId }),
    },
  ));
}
