import { linkHasConsentScope } from "./consentScopes.js";

/**
 * Throws if the link has no patient consent for the requested scope.
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
