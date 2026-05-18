/**
 * Phase 1 feature flags — default off unless explicitly enabled in environment.
 * Legacy routes (Pre-Visit, follow-ups, visitMedications) are unaffected when flags are off.
 */

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "true" || raw === "1";
}

/** PracticePatientLink / care-relationship APIs (PR-1+). */
export function isCareRelationshipEnabled() {
  return envFlag("CARE_RELATIONSHIP_ENABLED", false);
}

/** MedicationPlan v2 (PR-6) — relationship-based plans. */
export function isMedicationPlanV2Enabled() {
  return envFlag("MEDICATION_PLAN_V2", false);
}

/** CommunicationThread v2 — not implemented in PR-0..2. */
export function isCommunicationV2Enabled() {
  return envFlag("COMMUNICATION_V2", false);
}

/** Patient inbox — not implemented in PR-0..2. */
export function isPatientInboxEnabled() {
  return envFlag("PATIENT_INBOX", false);
}

/** Practice document sharing on care links (PR-7). */
export function isPracticeDocumentsV2Enabled() {
  return envFlag("PRACTICE_DOCUMENTS_V2", false);
}

/** Central practice inbox (aggregated operational items). */
export function isPracticeInboxEnabled() {
  return envFlag("PRACTICE_INBOX", false);
}
