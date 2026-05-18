/**
 * Developer API scopes & webhook event types — metadata-only payloads.
 */

export const API_SCOPES = Object.freeze([
  "read:practice",
  "read:patients_metadata",
  "read:appointments",
  "read:documents_metadata",
  "read:medication_metadata",
  "read:messages_metadata",
  "write:webhooks",
  "read:audit_metadata",
]);

export const PracticeDeveloperWebhookEvent = Object.freeze({
  TEST_PING: "test.ping",
  PATIENT_LINK_CREATED: "practice_patient_link.created",
  PATIENT_LINK_ARCHIVED: "practice_patient_link.archived",
  PROFILE_ACCESS_GRANTED: "patient.profile_access.granted",
  PROFILE_ACCESS_REVOKED: "patient.profile_access.revoked",
  INBOX_ITEM_CREATED: "inbox.item.created",
  THREAD_CREATED: "message.thread.created",
  MESSAGE_CREATED: "message.created",
  DOCUMENT_SHARED: "document.shared",
  DOCUMENT_REVOKED: "document.revoked",
  DOCUMENT_DELETED: "document.deleted",
  MEDICATION_PUBLISHED: "medication_plan.published",
  MEDICATION_ARCHIVED: "medication_plan.archived",
  APPOINTMENT_CREATED: "appointment.created",
  APPOINTMENT_UPDATED: "appointment.updated",
  APPOINTMENT_CANCELLED: "appointment.cancelled",
  APPOINTMENT_CONFIRMED: "appointment.confirmed",
  DATA_REQUEST_CREATED: "data_request.created",
  DATA_REQUEST_UPDATED: "data_request.updated",
  CONSENT_REVOKED: "consent.revoked",
  SECURE_LINK_REVOKED: "secure_link.revoked",
});

export const PRACTICE_DEVELOPER_WEBHOOK_EVENTS = Object.freeze(
  Object.values(PracticeDeveloperWebhookEvent),
);

export const SCOPE_TO_V1 = {
  "read:practice": ["/me"],
  "read:patients_metadata": ["/patients"],
  "read:appointments": ["/appointments"],
  "read:documents_metadata": ["/documents"],
  "read:medication_metadata": ["/medication-plans"],
  "read:messages_metadata": ["/messages/threads"],
  "read:audit_metadata": ["/audit-events"],
  "write:webhooks": [],
};
