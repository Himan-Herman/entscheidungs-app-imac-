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

/** PVS/FHIR/HL7 integration layer (UI + APIs). Default off. */
export function isIntegrationsEnabled() {
  return envFlag("ENABLE_INTEGRATIONS", false);
}

/** FHIR adapter endpoints (preview/validate). Requires integrations master flag in routes. */
export function isFhirIntegrationEnabled() {
  return envFlag("ENABLE_FHIR_INTEGRATION", false);
}

/** HL7 v2 parse/ack preview. Requires integrations master flag in routes. */
export function isHl7v2IntegrationEnabled() {
  return envFlag("ENABLE_HL7V2_INTEGRATION", false);
}

/** Sandbox / test mode — sample payloads, no outbound production traffic. Default on when unset. */
export function isPvsSandboxEnabled() {
  return envFlag("ENABLE_PVS_SANDBOX", true);
}

/** Production PVS sync / live outbound — never default on. */
export function isPvsProductionEnabled() {
  return envFlag("ENABLE_PVS_PRODUCTION", false);
}

/** Whether practice integration UI/API is reachable (master OR sandbox). */
export function isIntegrationsUiEnabled() {
  return isIntegrationsEnabled() || isPvsSandboxEnabled();
}
