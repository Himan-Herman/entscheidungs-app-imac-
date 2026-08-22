import { authFetch } from "../../../api/authFetch.js";

/**
 * The patient's own care relationships for the chooser and the switcher.
 *
 * Metadata and counts only — the server never sends message bodies or thread
 * subjects here, so a badge can never carry health information.
 */
export async function fetchPracticeContexts({ signal } = {}) {
  const res = await authFetch("/api/patient/practice-contexts", { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
