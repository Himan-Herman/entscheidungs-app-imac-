import { authFetch } from "../../../api/authFetch.js";

/**
 * The header's notification entry point.
 *
 * TWO CALLS, NEVER BOTH
 * ---------------------
 * Patient mode calls the patient endpoint, practice mode the practice one.
 * There is no combined request and no client-side filtering of a mixed
 * response: the server decides what this session may see, and a response that
 * was never fetched cannot leak when the mode changes mid-flight.
 */

async function call(url, signal) {
  const res = await authFetch(url, { signal });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const fetchPatientNotifications = (signal) =>
  call("/api/patient/inbox/notifications", signal);

export const fetchPracticeNotifications = (practiceId, signal) =>
  call(
    `/api/practice/inbox/notifications?practiceId=${encodeURIComponent(practiceId)}`,
    signal,
  );

/** The practice list the header falls back to when the URL names no practice. */
export const fetchMyPractices = (signal) => call("/api/practices", signal);
