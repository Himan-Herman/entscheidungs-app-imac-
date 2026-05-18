import { linkHasConsentScope } from "./consentScopes.js";
import { LEGACY_SCOPE_TO_CONSENT_TYPE } from "../consent/consentTypes.js";
import { assertConsentForLink } from "../consent/consentRecordService.js";

/**
 * Throws if the link has no patient consent for the requested scope (sync, legacy scopes array).
 * @param {import("@prisma/client").PracticePatientLink} link
 * @param {string} scope
 */
export function requireConsentScope(link, scope) {
  if (!linkHasConsentScope(link, scope)) {
    const err = new Error("consent_required");
    err.scope = scope;
    throw err;
  }
}

/**
 * Async check against ConsentRecord + synced scopes.
 * @param {import("@prisma/client").PracticePatientLink} link
 * @param {string} scope legacy scope or consent type
 * @param {{ req?: import('express').Request, actorUserId?: string, actorRole?: string }} ctx
 */
export async function requireConsentScopeAsync(link, scope, ctx = {}) {
  const consentType = LEGACY_SCOPE_TO_CONSENT_TYPE[scope] || scope;
  await assertConsentForLink(link, consentType, ctx);
}
