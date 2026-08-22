/**
 * Where a patient inbox notice leads, in the CROSS-PRACTICE inbox.
 *
 * `targetUrl` is written into the row when the notice is created, which means a
 * route rename leaves every existing notice pointing at a path that no longer
 * exists. That is not hypothetical: medication notices were stored as
 * `/patient/medication-plans/<id>` while the real patient route has always been
 * `/patient/medication-plans/practice/<id>`, so every one of them led nowhere.
 *
 * So for the kinds whose destination can be reconstructed, it IS reconstructed
 * — from `sourceRefType` and `sourceRefId`, at read time. The stored value is
 * then only a fallback for kinds this module does not know, and a stale or
 * tampered row cannot decide where a known kind navigates.
 *
 * This is the PATIENT-GLOBAL inbox. Practice-context destinations are built
 * separately, from the authorized link, in patientInboxContextService.js — a
 * practice URL must never be reconstructed from a practice id.
 */

/**
 * Kinds whose patient-facing route is a deterministic function of the source id.
 * Verified against the client router; a rename here must be made together with
 * the route it names.
 */
const CANONICAL_PATHS = Object.freeze({
  patient_thread: (id) => `/patient/messages/${encodeURIComponent(id)}`,
  medication_plan: (id) => `/patient/medication-plans/practice/${encodeURIComponent(id)}`,
  practice_document: (id) => `/patient/practice-documents/${encodeURIComponent(id)}`,
  telemedicine_session: (id) => `/patient/telemedicine/${encodeURIComponent(id)}`,
});

/**
 * An internal path, or null.
 *
 * Rejects anything that is not a same-origin path: absolute URLs, and
 * protocol-relative `//host` which a browser treats as external. The client
 * checks this too; doing it here as well means a bad row never leaves the
 * server in the first place.
 *
 * @param {unknown} url
 */
export function safeInternalPath(url) {
  if (typeof url !== "string") return null;
  const v = url.trim();
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}

/**
 * The destination for one stored notice.
 *
 * @param {{ sourceRefType?: string | null, sourceRefId?: string | null, targetUrl?: string | null }} row
 * @returns {string | null}
 */
export function patientInboxTargetUrl(row) {
  const build = CANONICAL_PATHS[row?.sourceRefType];
  const sourceRefId = String(row?.sourceRefId ?? "").trim();
  if (build && sourceRefId) return build(sourceRefId);

  // Unknown kind, or a kind whose destination carries query parameters rather
  // than an id in the path. The stored value is used, but only if it is a
  // same-origin path.
  return safeInternalPath(row?.targetUrl);
}
