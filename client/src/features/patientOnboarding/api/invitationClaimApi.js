/**
 * Patient-side calls: the public preview, and the claim itself.
 *
 * Both send the credential in a POST body, never in a path or a query string.
 * The preview needs no account and writes nothing; the claim needs an account
 * and is the only call here that changes anything.
 */
import { authFetch } from "../../../api/authFetch.js";
import { resolveApiUrl } from "../../../lib/apiBase.js";

async function unwrap(res) {
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* empty body stays empty */
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
 * Who is inviting me, and is this still valid?
 *
 * Unauthenticated on purpose — the patient must be able to see who is asking
 * BEFORE deciding whether to create an account. Read-only: calling it a hundred
 * times changes nothing.
 *
 * Returns only `{ practice: { displayName, specialty, city } }`. No patient
 * data, no identifiers, no expiry date.
 *
 * @param {{ token?: string|null, code?: string|null }} credential
 */
export async function previewInvitation({ token = null, code = null }) {
  if (token) {
    return unwrap(await fetch(resolveApiUrl("/api/public/patient-invitations/preview"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }));
  }
  return unwrap(await fetch(resolveApiUrl("/api/public/patient-invitations/manual-code/check"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  }));
}

/**
 * Bind the account to the practice.
 *
 * Authenticated, deliberate, and the only mutating call in this flow. It creates
 * the technical relationship and nothing else — consent is a separate step the
 * patient takes afterwards.
 *
 * @param {{ token?: string|null, code?: string|null,
 *           subject: { type: "self" } | { type: "patient_profile", patientProfileId: string } }} input
 */
export async function claimInvitation({ token = null, code = null, subject }) {
  return unwrap(await authFetch("/api/patient/invitations/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Exactly one credential travels; the other key is omitted entirely rather
    // than sent as null, so the server's "exactly one" rule reads cleanly.
    body: JSON.stringify(token ? { token, subject } : { code, subject }),
  }));
}

/** The account's own non-archived family profiles, for the subject picker. */
export async function fetchFamilyProfiles() {
  return unwrap(await authFetch("/api/account/family-profiles"));
}
