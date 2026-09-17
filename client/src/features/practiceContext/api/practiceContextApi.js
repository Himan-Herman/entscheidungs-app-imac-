import { authFetch } from "../../../api/authFetch.js";

/**
 * Validates one care relationship against the SERVER.
 *
 * Reuses the existing patient endpoint, which scopes on the session's own user
 * id and answers `link_not_found` both for a link that does not exist and for
 * one belonging to somebody else — the established convention that avoids
 * disclosing whose it is.
 *
 * @param {string} linkId
 */
export async function fetchPatientPracticeLink(linkId) {
  const res = await authFetch(`/api/patient/links/${encodeURIComponent(linkId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** The patient's own authorized relationships — the later selector's data source. */
export async function fetchPatientPracticeContexts() {
  const res = await authFetch("/api/patient/links");
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
