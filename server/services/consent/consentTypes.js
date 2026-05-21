/** Granular consent types — organizational only, no clinical treatment categories. */
export const CONSENT_TYPES = Object.freeze([
  "profile_access",
  "document_sharing",
  "medication_plan_access",
  "secure_messaging",
  "data_export",
  "ai_organizational_assistance",
  "optional_email_notifications",
  "optional_secure_links",
  "interpreter_cloud_storage",
  "interpreter_practice_share",
]);

export const CONSENT_STATUSES = new Set(["granted", "revoked", "expired"]);

const TYPE_SET = new Set(CONSENT_TYPES);

/** Maps consent type → legacy scope key on PracticePatientLink.consentScopes */
export const CONSENT_TYPE_TO_LEGACY_SCOPE = Object.freeze({
  profile_access: "profile",
  medication_plan_access: "medication",
  secure_messaging: "messages",
  document_sharing: "documents",
  data_export: "data_export",
  ai_organizational_assistance: "ai_organizational",
  optional_email_notifications: "email_notifications",
  optional_secure_links: "secure_links",
});

/** Legacy scope → consent type (Phase-1 scopes) */
export const LEGACY_SCOPE_TO_CONSENT_TYPE = Object.freeze({
  profile: "profile_access",
  medication: "medication_plan_access",
  messages: "secure_messaging",
  documents: "document_sharing",
});

/**
 * @param {string} type
 */
export function isValidConsentType(type) {
  return TYPE_SET.has(String(type || "").trim());
}
