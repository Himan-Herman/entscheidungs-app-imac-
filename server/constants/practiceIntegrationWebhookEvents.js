/**
 * Outbound webhook event types (metadata-only payloads by policy).
 * Delivery requires webhook URL + encrypted signing secret + PRACTICE_WEBHOOK_DELIVERY_ENABLED=true.
 */

export const PracticeWebhookEventType = {
  PREVISIT_CREATED: "previsit.created",
  PREVISIT_PDF_CREATED: "previsit.pdf_created",
  PREVISIT_SENT: "previsit.sent",
  FOLLOWUP_CREATED: "followup.created",
  FOLLOWUP_ANSWERED: "followup.answered",
  SECURE_DOCUMENT_CREATED: "secure_document.created",
  SECURE_DOCUMENT_DOWNLOADED: "secure_document.downloaded",
  WEBHOOK_TEST: "webhook.test",
};

export const PRACTICE_WEBHOOK_EVENT_TYPES = Object.freeze(
  Object.values(PracticeWebhookEventType),
);

export const DOCUMENT_DELIVERY_MODES = Object.freeze([
  "download_only",
  "email",
  "secure_portal",
  "webhook",
]);
