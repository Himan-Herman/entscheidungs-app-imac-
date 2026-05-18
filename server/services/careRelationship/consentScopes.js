/** Current care-relationship consent document version (legal copy is maintained separately). */
export const CARE_CONSENT_VERSION = "phase1-care-v1";

/** Scopes a patient may grant per practice link (Phase 1). */
export const CONSENT_SCOPES = Object.freeze(["medication", "messages"]);

const SCOPE_SET = new Set(CONSENT_SCOPES);

/**
 * @param {unknown} scopes
 * @returns {string[]}
 */
export function normalizeConsentScopes(scopes) {
  if (!Array.isArray(scopes)) return [];
  const out = [];
  for (const s of scopes) {
    const v = String(s || "").trim();
    if (v && SCOPE_SET.has(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * @param {string | null | undefined} version
 */
export function isAllowedConsentVersion(version) {
  const v = String(version || "").trim();
  return v.length > 0 && v === CARE_CONSENT_VERSION;
}

/**
 * @param {import("@prisma/client").PracticePatientLink} link
 * @param {string} scope
 */
export function linkHasConsentScope(link, scope) {
  if (!link?.consentAcceptedAt) return false;
  const scopes = Array.isArray(link.consentScopes) ? link.consentScopes : [];
  if (scopes.length === 0) {
    // Grandfather: consent recorded before scopes were stored — treat as all Phase-1 scopes.
    return SCOPE_SET.has(scope);
  }
  return scopes.includes(scope);
}
