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
};

/**
 * @param {string} action
 */
export function registryForAction(action) {
  return AUDIT_ACTION_REGISTRY[action] || null;
}
