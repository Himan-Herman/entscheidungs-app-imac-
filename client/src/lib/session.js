/**
 * Ending a session in this browser — the one place that knows what a signed-in
 * session leaves behind.
 *
 * WHY ONE PLACE. Signing out used to live inline in the header, and "use a
 * different account" on the invitation page needs exactly the same cleanup.
 * Two copies drift, and the drift here is a privacy defect: on a shared
 * family device, whatever one copy forgets is readable by the next person.
 *
 * WHAT IT CLEARS
 *   - the session itself (token, user id);
 *   - the symptom-chat thread ids, which point at the previous person's
 *     conversations;
 *   - the header's identity cache (name + initials). It was NOT cleared before,
 *     so after a sign-out the next account briefly saw the previous person's
 *     name in the header until the fresh copy arrived.
 *
 * WHAT IT DELIBERATELY KEEPS
 *   - sessionStorage: a pending practice invitation lives there per tab, and a
 *     person switching accounts to accept it must not lose it on the way;
 *   - UI preferences (language, theme, mode), which belong to the device, not
 *     to a person.
 */
import { getAuthHeaders } from "../api/authHeaders.js";
import { resolveApiUrl } from "./apiBase.js";
import { IDENTITY_CHANGED_EVENT } from "../hooks/useAccountIdentity.js";

export const SESSION_STORAGE_KEYS = Object.freeze([
  "medscout_token",
  "medscout_user_id",
  "symptom_thread_id",
  "koerper_thread_id",
  "textsymptom_thread_id",
  "medscoutx_identity_patient",
  "medscoutx_identity_practice",
]);

/**
 * Tell the server, then forget everything local — in that order, and the local
 * part even when the server cannot be reached.
 *
 * Plain fetch rather than authFetch on purpose: an already-expired token makes
 * authFetch redirect to the login page, which would throw away wherever the
 * caller wanted to go next.
 */
export async function endSession() {
  try {
    await fetch(resolveApiUrl("/api/auth/logout"), {
      method: "POST",
      headers: getAuthHeaders(),
    });
  } catch {
    /* the local session is cleared regardless */
  }
  for (const key of SESSION_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable — nothing left to clear */
    }
  }
  try {
    window.dispatchEvent(new CustomEvent(IDENTITY_CHANGED_EVENT));
  } catch {
    /* no window (tests) */
  }
}
