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
 * A base that exists only so the URL parser has something to resolve against.
 * Never sent anywhere; only its origin is compared.
 */
const SAME_ORIGIN_PROBE = "https://medscoutx.invalid";

/**
 * An internal path, or null.
 *
 * ── Why this asks the parser instead of inspecting characters ───────────────
 * The previous version checked that the value began with `/` and not `//`.
 * That is the obvious rule and it is not enough, because the browser rewrites
 * the string before it resolves it. Three values passed that check and still
 * left the origin — measured, not assumed:
 *
 *     "/\evil.example"     ->  https://evil.example
 *     "/\/evil.example"    ->  https://evil.example
 *     "/<TAB>/evil.example" ->  https://evil.example
 *
 * A backslash is normalised to a slash, so `/\host` becomes `//host` — the
 * protocol-relative form the check was written to catch. This is the bypass
 * behind CVE-2025-68470, and hand-written character rules will keep missing
 * the next variant of it.
 *
 * So the question is put to the same parser the browser uses: resolve the
 * value against a base and require the origin to be unchanged. Anything that
 * moves the origin — absolute, protocol-relative, backslash, embedded control
 * characters, or a normalisation nobody has thought of yet — is refused
 * without this function needing to know why.
 *
 * The client repeats this check before navigating. That is defence in depth
 * against a stale build, not a second policy: both answer the same question.
 *
 * @param {unknown} url
 * @returns {string | null}
 */
export function safeInternalPath(url) {
  if (typeof url !== "string") return null;
  const v = url.trim();
  if (!v.startsWith("/")) return null;

  let resolved;
  try {
    resolved = new URL(v, SAME_ORIGIN_PROBE);
  } catch {
    return null;
  }
  if (resolved.origin !== SAME_ORIGIN_PROBE) return null;

  // The value is returned as written, not as the parser rewrote it: the router
  // is given exactly what was stored, and what was stored has now been shown
  // to stay on this origin.
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
