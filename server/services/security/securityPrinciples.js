/**
 * Security architecture principles (organizational / technical — not legal advice).
 * Exposed read-only to owner/admin security overview APIs.
 */
export const SECURITY_PRINCIPLES = Object.freeze([
  "least_privilege",
  "deny_by_default",
  "server_side_authorization",
  "data_minimization",
  "short_lived_tokens",
  "secure_downloads",
  "soft_delete_mvp",
  "consent_enforcement",
  "auditability",
]);
