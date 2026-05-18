/**
 * Maps audit actions to user-facing activity feed types and visibility.
 * internal = practice audit API only; not shown in patient/practice activity feeds.
 */

/** @type {Record<string, { activityType: string, visibility: 'internal' | 'practice_visible' | 'patient_visible', severity?: string, audience?: 'both' | 'practice' | 'patient' }>} */
export const AUDIT_ACTION_REGISTRY = {
  practice_patient_link_created: {
    activityType: "relationship_created",
    visibility: "practice_visible",
    audience: "practice",
  },
  practice_patient_link_consent_accepted: {
    activityType: "relationship_active",
    visibility: "practice_visible",
    audience: "both",
  },
  practice_patient_link_status_updated: {
    activityType: "relationship_status_changed",
    visibility: "practice_visible",
    audience: "practice",
  },
  practice_patient_list_opened: {
    activityType: "patient_list_opened",
    visibility: "internal",
    audience: "practice",
  },
  practice_patient_search_executed: {
    activityType: "patient_search",
    visibility: "internal",
    audience: "practice",
  },
  practice_patient_record_search: {
    activityType: "patient_record_search",
    visibility: "internal",
    audience: "practice",
  },
  practice_patient_record_opened_from_search: {
    activityType: "patient_record_opened",
    visibility: "internal",
    audience: "practice",
  },
  export_job_requested: {
    activityType: "export_requested",
    visibility: "internal",
    audience: "practice",
  },
  export_job_completed: {
    activityType: "export_completed",
    visibility: "internal",
    audience: "practice",
  },
  export_job_failed: {
    activityType: "export_failed",
    visibility: "internal",
    audience: "practice",
  },
  export_job_downloaded: {
    activityType: "export_downloaded",
    visibility: "internal",
    audience: "practice",
  },
  export_job_expired: {
    activityType: "export_expired",
    visibility: "internal",
    audience: "practice",
  },
  export_ai_organize_created: {
    activityType: "export_ai_organize",
    visibility: "internal",
    audience: "practice",
  },
  consent_record_granted: {
    activityType: "consent_granted",
    visibility: "patient_visible",
    audience: "patient",
  },
  consent_record_revoked: {
    activityType: "consent_revoked",
    visibility: "patient_visible",
    audience: "patient",
  },
  consent_record_expired: {
    activityType: "consent_expired",
    visibility: "patient_visible",
    audience: "patient",
  },
  consent_access_denied: {
    activityType: "consent_access_denied",
    visibility: "internal",
    audience: "practice",
  },
  consent_ai_explanation_created: {
    activityType: "consent_ai_explanation",
    visibility: "internal",
    audience: "patient",
  },
  security_event: {
    activityType: "security_event",
    visibility: "internal",
    severity: "security",
    audience: "practice",
  },
  security_ai_summary_created: {
    activityType: "security_ai_summary",
    visibility: "internal",
    severity: "security",
    audience: "practice",
  },
  login_success: {
    activityType: "login_success",
    visibility: "internal",
    audience: "practice",
  },
  logout: {
    activityType: "logout",
    visibility: "internal",
    audience: "practice",
  },
  ui_locale_changed: {
    activityType: "locale_changed",
    visibility: "internal",
    audience: "patient",
  },
  i18n_ai_translation_created: {
    activityType: "i18n_ai_translation",
    visibility: "internal",
    audience: "patient",
  },
  secure_document_access_denied: {
    activityType: "secure_download_denied",
    visibility: "internal",
    severity: "security",
    audience: "practice",
  },
  practice_patient_search_ai_suggestion: {
    activityType: "patient_search_ai",
    visibility: "internal",
    audience: "practice",
  },
  practice_patient_link_archived: {
    activityType: "relationship_archived",
    visibility: "practice_visible",
    audience: "both",
  },
  practice_patient_link_archived_by_patient: {
    activityType: "relationship_archived",
    visibility: "practice_visible",
    audience: "both",
  },
  patient_profile_access_granted: {
    activityType: "profile_access_granted",
    visibility: "practice_visible",
    audience: "both",
  },
  patient_profile_access_revoked: {
    activityType: "profile_access_revoked",
    visibility: "practice_visible",
    audience: "both",
  },
  profile_access_granted: {
    activityType: "profile_access_granted",
    visibility: "practice_visible",
    audience: "both",
  },
  profile_access_revoked: {
    activityType: "profile_access_revoked",
    visibility: "practice_visible",
    audience: "both",
  },
  patient_profile_viewed: {
    activityType: "profile_viewed",
    visibility: "patient_visible",
    audience: "patient",
  },
  profile_viewed: {
    activityType: "profile_viewed",
    visibility: "patient_visible",
    audience: "patient",
  },
  practice_thread_created: {
    activityType: "thread_created",
    visibility: "practice_visible",
    audience: "both",
  },
  practice_thread_message_sent: {
    activityType: "message_received",
    visibility: "patient_visible",
    audience: "patient",
  },
  patient_thread_message_sent: {
    activityType: "message_sent",
    visibility: "practice_visible",
    audience: "practice",
  },
  practice_thread_closed: {
    activityType: "thread_closed",
    visibility: "practice_visible",
    audience: "both",
  },
  practice_thread_archived: {
    activityType: "thread_archived",
    visibility: "practice_visible",
    audience: "both",
  },
  patient_thread_archived: {
    activityType: "thread_archived",
    visibility: "practice_visible",
    audience: "both",
  },
  practice_document_created: {
    activityType: "document_created",
    visibility: "practice_visible",
    audience: "practice",
  },
  practice_document_file_uploaded: {
    activityType: "document_file_uploaded",
    visibility: "practice_visible",
    audience: "practice",
  },
  practice_document_shared: {
    activityType: "document_shared",
    visibility: "patient_visible",
    audience: "patient",
  },
  practice_document_share_revoked: {
    activityType: "document_share_revoked",
    visibility: "patient_visible",
    audience: "patient",
  },
  practice_document_opened: {
    activityType: "document_opened",
    visibility: "practice_visible",
    audience: "practice",
  },
  practice_document_download: {
    activityType: "document_downloaded",
    visibility: "practice_visible",
    audience: "practice",
  },
  secure_document_link_created: {
    activityType: "secure_link_created",
    visibility: "practice_visible",
    audience: "practice",
  },
  secure_document_link_revoked: {
    activityType: "secure_link_revoked",
    visibility: "practice_visible",
    audience: "practice",
  },
  secure_document_download_started: {
    activityType: "document_downloaded",
    visibility: "practice_visible",
    audience: "both",
  },
  secure_document_access_denied: {
    activityType: "access_denied",
    visibility: "practice_visible",
    audience: "practice",
  },
  practice_document_archived: {
    activityType: "document_archived",
    visibility: "practice_visible",
    audience: "both",
  },
  practice_document_deleted: {
    activityType: "document_deleted",
    visibility: "practice_visible",
    audience: "both",
  },
  practice_document_restored: {
    activityType: "document_restored",
    visibility: "practice_visible",
    audience: "practice",
  },
  medication_plan_restored: {
    activityType: "medication_plan_restored",
    visibility: "practice_visible",
    audience: "practice",
  },
  practice_thread_restored: {
    activityType: "thread_restored",
    visibility: "both",
    audience: "both",
  },
  patient_thread_restored: {
    activityType: "thread_restored",
    visibility: "patient_visible",
    audience: "patient",
  },
  patient_inbox_item_restored: {
    activityType: "inbox_restored",
    visibility: "patient_visible",
    audience: "patient",
  },
  practice_inbox_item_restored: {
    activityType: "inbox_restored",
    visibility: "practice_visible",
    audience: "practice",
  },
  archive_ai_summary_created: {
    activityType: "archive_summary",
    visibility: "internal",
    audience: "practice",
  },
  lifecycle_access_denied: {
    activityType: "access_denied",
    visibility: "internal",
    audience: "practice",
  },
  medication_plan_created: {
    activityType: "medication_plan_created",
    visibility: "practice_visible",
    audience: "practice",
  },
  medication_plan_published: {
    activityType: "medication_plan_published",
    visibility: "patient_visible",
    audience: "patient",
  },
  medication_plan_archived: {
    activityType: "medication_plan_archived",
    visibility: "practice_visible",
    audience: "both",
  },
  medication_plan_deleted: {
    activityType: "medication_plan_deleted",
    visibility: "practice_visible",
    audience: "both",
  },
  medication_plan_opened: {
    activityType: "medication_plan_opened",
    visibility: "practice_visible",
    audience: "practice",
  },
  patient_data_request_submitted: {
    activityType: "data_request_submitted",
    visibility: "practice_visible",
    audience: "practice",
  },
  patient_data_export_request_submitted: {
    activityType: "data_export_requested",
    visibility: "practice_visible",
    audience: "practice",
  },
  patient_data_request_status_changed: {
    activityType: "data_request_updated",
    visibility: "patient_visible",
    audience: "patient",
  },
  patient_profile_ai_summary_created: {
    activityType: "ai_summary_created",
    visibility: "internal",
    severity: "info",
  },
  patient_data_request_ai_summary_created: {
    activityType: "ai_summary_created",
    visibility: "internal",
  },
  practice_inbox_ai_summary_created: {
    activityType: "ai_summary_created",
    visibility: "internal",
  },
  practice_thread_ai_draft: { activityType: "ai_draft", visibility: "internal" },
  patient_thread_ai_draft: { activityType: "ai_draft", visibility: "internal" },
  medication_plan_ai_format: { activityType: "ai_draft", visibility: "internal" },
  practice_document_ai_title_draft: { activityType: "ai_draft", visibility: "internal" },
  document_ocr_started: {
    activityType: "document_ocr_started",
    visibility: "internal",
    audience: "practice",
  },
  document_ocr_completed: {
    activityType: "document_ocr_completed",
    visibility: "internal",
    audience: "practice",
  },
  document_ocr_failed: {
    activityType: "document_ocr_failed",
    visibility: "internal",
    audience: "practice",
  },
  document_ocr_result_opened: {
    activityType: "document_ocr_result_opened",
    visibility: "internal",
    audience: "practice",
  },
  document_ocr_result_corrected: {
    activityType: "document_ocr_result_corrected",
    visibility: "internal",
    audience: "practice",
  },
  document_ocr_result_shared: {
    activityType: "document_ocr_result_shared",
    visibility: "internal",
    audience: "practice",
  },
  document_ocr_result_discarded: {
    activityType: "document_ocr_result_discarded",
    visibility: "internal",
    audience: "practice",
  },
  document_ocr_structured_opened: {
    activityType: "document_ocr_structured_opened",
    visibility: "internal",
    audience: "patient",
  },
  practice_api_client_created: {
    activityType: "practice_api_client_created",
    visibility: "internal",
    audience: "practice",
  },
  practice_api_token_revoked: {
    activityType: "practice_api_token_revoked",
    visibility: "internal",
    audience: "practice",
  },
  practice_webhook_endpoint_created: {
    activityType: "practice_webhook_endpoint_created",
    visibility: "internal",
    audience: "practice",
  },
  practice_webhook_endpoint_updated: {
    activityType: "practice_webhook_endpoint_updated",
    visibility: "internal",
    audience: "practice",
  },
  practice_webhook_test_sent: {
    activityType: "practice_webhook_test_sent",
    visibility: "internal",
    audience: "practice",
  },
  practice_developer_ai_note: {
    activityType: "practice_developer_ai_note",
    visibility: "internal",
    audience: "practice",
  },
  access_denied: { activityType: "access_denied", visibility: "internal", severity: "security" },
  forbidden: { activityType: "access_denied", visibility: "internal", severity: "security" },
  practice_team_list_viewed: {
    activityType: "team_viewed",
    visibility: "internal",
  },
  practice_team_member_invited: {
    activityType: "team_member_invited",
    visibility: "internal",
  },
  practice_team_invite_accepted: {
    activityType: "team_invite_accepted",
    visibility: "internal",
  },
  practice_team_member_role_changed: {
    activityType: "team_role_changed",
    visibility: "internal",
    severity: "security",
  },
  practice_team_member_revoked: {
    activityType: "team_member_revoked",
    visibility: "internal",
    severity: "security",
  },
  practice_team_ai_summary_created: {
    activityType: "ai_summary_created",
    visibility: "internal",
  },
  patient_inbox_item_created: { activityType: "inbox_item_created", visibility: "patient" },
  patient_inbox_opened: { activityType: "inbox_opened", visibility: "patient" },
  patient_inbox_item_read: { activityType: "inbox_read", visibility: "patient" },
  patient_inbox_item_archived: { activityType: "inbox_archived", visibility: "patient" },
  patient_inbox_ai_summary_created: {
    activityType: "ai_summary_created",
    visibility: "patient",
  },
  practice_inbox_item_created: { activityType: "inbox_item_created", visibility: "internal" },
  practice_inbox_opened: { activityType: "inbox_opened", visibility: "internal" },
  practice_inbox_item_opened: { activityType: "inbox_opened", visibility: "internal" },
  practice_inbox_item_read: { activityType: "inbox_read", visibility: "internal" },
  practice_inbox_item_done: { activityType: "inbox_done", visibility: "internal" },
  practice_inbox_item_archived: { activityType: "inbox_archived", visibility: "internal" },
  practice_inbox_ai_summary_created: {
    activityType: "ai_summary_created",
    visibility: "internal",
  },
  practice_settings_updated: {
    activityType: "practice_settings_updated",
    visibility: "internal",
    audience: "practice",
  },
  practice_logo_uploaded: {
    activityType: "practice_logo_uploaded",
    visibility: "internal",
    audience: "practice",
  },
  practice_logo_deleted: {
    activityType: "practice_logo_deleted",
    visibility: "internal",
    audience: "practice",
  },
  practice_settings_ai_description: {
    activityType: "practice_settings_ai_description",
    visibility: "internal",
    audience: "practice",
  },
  integration_connection_created: {
    activityType: "integration_connection_created",
    visibility: "internal",
    audience: "practice",
  },
  integration_connection_updated: {
    activityType: "integration_connection_updated",
    visibility: "internal",
    audience: "practice",
  },
  integration_connection_disabled: {
    activityType: "integration_connection_disabled",
    visibility: "internal",
    audience: "practice",
  },
  integration_connection_tested: {
    activityType: "integration_connection_tested",
    visibility: "internal",
    audience: "practice",
  },
  integration_job_started: {
    activityType: "integration_job_started",
    visibility: "internal",
    audience: "practice",
  },
  integration_job_completed: {
    activityType: "integration_job_completed",
    visibility: "internal",
    audience: "practice",
  },
  integration_job_failed: {
    activityType: "integration_job_failed",
    visibility: "internal",
    audience: "practice",
  },
  integration_export_blocked_consent: {
    activityType: "integration_export_blocked_consent",
    visibility: "internal",
    audience: "practice",
  },
  integration_fhir_preview: {
    activityType: "integration_fhir_preview",
    visibility: "internal",
    audience: "practice",
  },
  integration_hl7_parse_test: {
    activityType: "integration_hl7_parse_test",
    visibility: "internal",
    audience: "practice",
  },
  integration_ai_mapping_summary: {
    activityType: "integration_ai_mapping_summary",
    visibility: "internal",
    audience: "practice",
  },
  integration_ai_error_explanation: {
    activityType: "integration_ai_error_explanation",
    visibility: "internal",
    audience: "practice",
  },
  appointment_created: {
    activityType: "appointment_created",
    visibility: "internal",
    audience: "practice",
  },
  appointment_updated: {
    activityType: "appointment_updated",
    visibility: "internal",
    audience: "practice",
  },
  appointment_rescheduled: {
    activityType: "appointment_rescheduled",
    visibility: "internal",
    audience: "practice",
  },
  appointment_cancelled: {
    activityType: "appointment_cancelled",
    visibility: "internal",
    audience: "practice",
  },
  appointment_confirmed: {
    activityType: "appointment_confirmed",
    visibility: "internal",
    audience: "practice",
  },
  appointment_request_created: {
    activityType: "appointment_request_created",
    visibility: "internal",
    audience: "practice",
  },
  appointment_cancel_requested: {
    activityType: "appointment_cancel_requested",
    visibility: "internal",
    audience: "practice",
  },
  appointment_type_created: {
    activityType: "appointment_type_created",
    visibility: "internal",
    audience: "practice",
  },
  appointment_type_updated: {
    activityType: "appointment_type_updated",
    visibility: "internal",
    audience: "practice",
  },
  appointment_type_archived: {
    activityType: "appointment_type_archived",
    visibility: "internal",
    audience: "practice",
  },
  availability_created: {
    activityType: "availability_created",
    visibility: "internal",
    audience: "practice",
  },
  availability_updated: {
    activityType: "availability_updated",
    visibility: "internal",
    audience: "practice",
  },
  availability_deleted: {
    activityType: "availability_deleted",
    visibility: "internal",
    audience: "practice",
  },
  appointment_ai_summary: {
    activityType: "appointment_ai_summary",
    visibility: "internal",
    audience: "practice",
  },
  appointment_ai_reply_draft: {
    activityType: "appointment_ai_reply_draft",
    visibility: "internal",
    audience: "practice",
  },
  appointment_ai_request_draft: {
    activityType: "appointment_ai_request_draft",
    visibility: "internal",
    audience: "patient",
  },
  telemedicine_session_created: {
    activityType: "telemedicine_session_created",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_consent_granted: {
    activityType: "telemedicine_consent_granted",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_link_revoked: {
    activityType: "telemedicine_link_revoked",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_link_opened: {
    activityType: "telemedicine_link_opened",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_patient_waiting: {
    activityType: "telemedicine_patient_waiting",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_session_started: {
    activityType: "telemedicine_session_started",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_session_completed: {
    activityType: "telemedicine_session_completed",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_session_cancelled: {
    activityType: "telemedicine_session_cancelled",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_settings_updated: {
    activityType: "telemedicine_settings_updated",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_ai_instructions: {
    activityType: "telemedicine_ai_instructions",
    visibility: "internal",
    audience: "practice",
  },
  telemedicine_ai_followup: {
    activityType: "telemedicine_ai_followup",
    visibility: "internal",
    audience: "practice",
  },
};

/**
 * @param {string} action
 */
export function registryForAction(action) {
  return AUDIT_ACTION_REGISTRY[action] || null;
}
