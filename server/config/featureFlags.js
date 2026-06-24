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

/** Practice calendar / appointments. On by default; disable with ENABLE_PRACTICE_CALENDAR=false. */
export function isPracticeCalendarEnabled() {
  return envFlag("ENABLE_PRACTICE_CALENDAR", true);
}

/** External calendar sync (Google/Outlook) — not in MVP. */
export function isExternalCalendarSyncEnabled() {
  return envFlag("ENABLE_EXTERNAL_CALENDAR_SYNC", false);
}

/** iCal export for appointments — gated separately from calendar UI. */
export function isIcalExportEnabled() {
  return envFlag("ENABLE_ICAL_EXPORT", false);
}

/** Telemedicine / video consultations. */
export function isTelemedicineEnabled() {
  return envFlag("ENABLE_TELEMEDICINE", false);
}

/** Sandbox video rooms (e.g. public Jitsi room names) without paid provider. */
export function isVideoSandboxEnabled() {
  return envFlag("ENABLE_VIDEO_SANDBOX", true);
}

/** Session recording — disabled in MVP. */
export function isVideoRecordingEnabled() {
  return envFlag("ENABLE_VIDEO_RECORDING", false);
}

/** Paid external video providers (Twilio/Daily/etc.). */
export function isExternalVideoProviderEnabled() {
  return envFlag("ENABLE_EXTERNAL_VIDEO_PROVIDER", false);
}

export function isTelemedicineUiEnabled() {
  return isTelemedicineEnabled() || isVideoSandboxEnabled();
}

/** Document OCR — text extraction only. */
export function isDocumentOcrEnabled() {
  return envFlag("ENABLE_DOCUMENT_OCR", false);
}

/** Lab table structuring from OCR output. */
export function isLabStructuringEnabled() {
  return envFlag("ENABLE_LAB_STRUCTURING", false);
}

/** AI-assisted document structuring (organizational; no interpretation). */
export function isAiDocumentStructuringEnabled() {
  return envFlag("ENABLE_AI_DOCUMENT_STRUCTURING", false);
}

/** Medical lab interpretation — must remain disabled; no implementation. */
export function isLabInterpretationEnabled() {
  return envFlag("ENABLE_LAB_INTERPRETATION", false);
}

/**
 * Patient-facing plain-language explanation of lab values (reference range + what the parameter
 * measures). No diagnosis, no urgency, no treatment advice — explanation layer only.
 */
export function isLabPatientExplanationEnabled() {
  return envFlag("ENABLE_LAB_PATIENT_EXPLANATION", false);
}

/** Patient-owned vaccination pass — self-reported entries, document upload, reminders. */
export function isVaccinationPassEnabled() {
  return envFlag("ENABLE_VACCINATION_PASS", false);
}

/** Structured health history — patient-owned allergy entries + diagnosis/condition entries. */
export function isHealthHistoryEnabled() {
  return envFlag("ENABLE_HEALTH_HISTORY", false);
}

/**
 * Personal symptom diary — patient-owned, chronological self-reported symptom entries
 * inside the health record. Documentation only: no diagnosis, therapy, triage, or urgency.
 * No AI in Phase 1. Default off until ENABLE_SYMPTOM_DIARY is set.
 */
export function isSymptomDiaryEnabled() {
  return envFlag("ENABLE_SYMPTOM_DIARY", false);
}

export function isDocumentOcrUiEnabled() {
  if (isLabInterpretationEnabled()) return false;
  return (
    isDocumentOcrEnabled() ||
    isLabStructuringEnabled() ||
    isAiDocumentStructuringEnabled()
  );
}

/** External practice REST API (Bearer tokens). */
export function isPracticeApiEnabled() {
  return envFlag("ENABLE_PRACTICE_API", false);
}

/** Multi-endpoint developer webhooks. */
export function isPracticeWebhooksEnabled() {
  return envFlag("ENABLE_PRACTICE_WEBHOOKS", false);
}

export function isWebhookTestModeEnabled() {
  return envFlag("ENABLE_WEBHOOK_TEST_MODE", true);
}

/** Must stay false in MVP — no health payloads in webhooks. */
export function isWebhookHealthDataPayloadsEnabled() {
  return envFlag("ENABLE_WEBHOOK_HEALTH_DATA_PAYLOADS", false);
}

export function isPracticeDeveloperUiEnabled() {
  return isPracticeApiEnabled() || isPracticeWebhooksEnabled();
}

/**
 * B2C Medical Interpreter — live multilingual healthcare communication only.
 * Not symptom check, diagnosis, triage, or treatment recommendation.
 * Default off until MEDICAL_INTERPRETER_ENABLED is set.
 */
export function isMedicalInterpreterEnabled() {
  return envFlag("MEDICAL_INTERPRETER_ENABLED", false);
}

/**
 * Medical Interpreter text-to-speech (OpenAI TTS).
 * Default on when the interpreter module is enabled; set INTERPRETER_TTS_ENABLED=false to disable.
 */
export function isInterpreterTtsEnabled() {
  if (!isMedicalInterpreterEnabled()) return false;
  const raw = process.env.INTERPRETER_TTS_ENABLED;
  if (raw === undefined || raw === "") return true;
  return raw === "true" || raw === "1";
}

/**
 * Medical Interpreter encrypted cloud session storage (Phase 3.2).
 * Default off. Requires MEDICAL_INTERPRETER_ENABLED and valid INTERPRETER_CLOUD_MASTER_KEY at runtime for writes.
 */
export function isInterpreterCloudEnabled() {
  if (!isMedicalInterpreterEnabled()) return false;
  return envFlag("INTERPRETER_CLOUD_ENABLED", false);
}

/**
 * Medical Interpreter B2B practice/clinic layer (Phase 4.2+).
 * Separate from B2C patient routes — no diagnosis, triage, or treatment guidance.
 * Patient consent is required before any practice access to session content (later phases).
 * Default off until MEDICAL_INTERPRETER_B2B_ENABLED is set.
 */
export function isMedicalInterpreterB2bEnabled() {
  if (!isMedicalInterpreterEnabled()) return false;
  return envFlag("MEDICAL_INTERPRETER_B2B_ENABLED", false);
}

/**
 * Experimental chunked streaming STT for interpreter (Phase 5.3).
 * Default off. Does not replace batch PTT transcribe.
 */
export function isInterpreterStreamingSttEnabled() {
  if (!isMedicalInterpreterEnabled()) return false;
  return envFlag("MEDICAL_INTERPRETER_STREAMING_STT_ENABLED", false);
}

/**
 * Near-realtime translation preview for streaming transcript (Phase 5.4).
 * Default off. Does not replace confirm-before-save translate flow.
 */
export function isInterpreterNearRealtimeTranslationEnabled() {
  if (!isMedicalInterpreterEnabled()) return false;
  return envFlag("MEDICAL_INTERPRETER_NEAR_REALTIME_TRANSLATION_ENABLED", false);
}

/**
 * Near-realtime / streaming TTS playback (Phase 5.5).
 * Default off. Requires base TTS capability when enabled.
 */
export function isInterpreterStreamingTtsEnabled() {
  if (!isMedicalInterpreterEnabled()) return false;
  if (!isInterpreterTtsEnabled()) return false;
  return envFlag("MEDICAL_INTERPRETER_STREAMING_TTS_ENABLED", false);
}

/** Patient vital measurements — manual entry, Phase 1. */
export function isVitalsEnabled() {
  return envFlag("ENABLE_VITALS", false);
}

/**
 * Simulated e-Rezept — practice issues prescriptions, patient views + redeems at pharmacy.
 * No real Telematikinfrastruktur connectivity. Upgrade path via FHIR adapter when TI is live.
 */
export function isErezeptEnabled() {
  return envFlag("ENABLE_E_REZEPT", false);
}

/**
 * Notfallausweis / SOS-Karte — patient-owned emergency card with offline QR.
 * Blood type, allergies, emergency contacts, AI summary. Default off.
 */
export function isSosCardEnabled() {
  return envFlag("ENABLE_SOS_CARD", false);
}

/**
 * Meda Realtime cloud archive — session metadata only, no turn content.
 * Requires explicit patient consent before any data is written.
 * Default off until MEDA_CLOUD_ARCHIVE_ENABLED is set.
 */
export function isMedaCloudArchiveEnabled() {
  return envFlag("MEDA_CLOUD_ARCHIVE_ENABLED", false);
}

/**
 * Practice PDF storage — metadata + storageKey only; file bytes go to Object Storage, never PostgreSQL.
 * Default off until PRACTICE_PDF_STORAGE_ENABLED is set.
 */
export function isPracticePdfStorageEnabled() {
  return envFlag("PRACTICE_PDF_STORAGE_ENABLED", false);
}

/**
 * Practice profile extended fields (legalName, street, preferredInterpreterLanguages).
 * Enables prefill of these fields in Meda setup and practice settings.
 * Default off until PRACTICE_PROFILE_EXTENDED_ENABLED is set.
 */
export function isPracticeProfileExtendedEnabled() {
  return envFlag("PRACTICE_PROFILE_EXTENDED_ENABLED", false);
}

/**
 * Practice consent recording — allows writing ConsentRecord rows for Meda Realtime sessions.
 * Default off until PRACTICE_CONSENT_RECORDING_ENABLED is set.
 */
export function isPracticeConsentRecordingEnabled() {
  return envFlag("PRACTICE_CONSENT_RECORDING_ENABLED", false);
}

/**
 * Practice Anamnesis — configurable questionnaire templates for verified practices.
 * Default off until PRACTICE_ANAMNESIS_ENABLED is set.
 */
export function isPracticeAnamnesisEnabled() {
  return envFlag("PRACTICE_ANAMNESIS_ENABLED", false);
}

/**
 * Practice Booking — internal appointment-request module (B2B2C).
 * No external links or redirects. Default off until PRACTICE_BOOKING_ENABLED is set.
 */
export function isPracticeBookingEnabled() {
  return envFlag("PRACTICE_BOOKING_ENABLED", false);
}

/**
 * GOÄ / PKV billing plausibility tool — automated hint only.
 * Not legally binding. Not a diagnosis. Not a billing decision.
 * Default off until ENABLE_BILLING_PLAUSIBILITY is set.
 */
export function isBillingPlausibilityEnabled() {
  return envFlag("ENABLE_BILLING_PLAUSIBILITY", false);
}

/**
 * Optional AI-assisted plausibility hints (Phase E).
 * Requires both ENABLE_BILLING_PLAUSIBILITY=true AND ENABLE_BILLING_AI_REVIEW=true.
 * Not a billing decision. Not medical advice. Not a reimbursement determination.
 * Default off — must be explicitly enabled.
 */
export function isBillingAiReviewEnabled() {
  if (!isBillingPlausibilityEnabled()) return false;
  return envFlag("ENABLE_BILLING_AI_REVIEW", false);
}

/**
 * Patient-facing "Rechnung verstehen" — plain-language explanation of a private
 * (GOÄ/PKV) invoice the patient enters manually. Stateless: no storage, no upload,
 * no OCR, no AI, no patient identifiers, no practiceId. Reuses the deterministic GOÄ
 * catalogue/warning engine only. Non-binding guidance — not legal advice, not a final
 * invoice review, not a medical assessment. Default off until ENABLE_PATIENT_BILLING_EXPLAIN is set.
 */
export function isPatientBillingExplainEnabled() {
  return envFlag("ENABLE_PATIENT_BILLING_EXPLAIN", false);
}
