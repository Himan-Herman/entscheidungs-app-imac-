/**
 * Push notifications — architecture placeholder only.
 *
 * Planned event categories (non-medical, non-urgent wording only):
 * - Follow-up message received (informational)
 * - PDF / document send confirmation (transactional)
 * - Practice response available (informational)
 * - Reminder to complete preparation (optional user opt-in)
 *
 * Explicitly avoid: diagnosis framing, treatment claims, emergency/triage,
 * clinical urgency, or “AI doctor” language in titles or bodies.
 *
 * TODO: Implement via service worker + backend subscription storage,
 *       or Capacitor/native bridge after store policy review.
 */

export const PUSH_EVENT_TYPES = Object.freeze({
  FOLLOW_UP_RECEIVED: "follow_up_received",
  PDF_SENT: "pdf_sent",
  PRACTICE_RESPONSE: "practice_response",
  PREP_REMINDER: "prep_reminder",
});

export function registerPushPlaceholder() {
  // Intentionally empty — wire-up deferred.
}
