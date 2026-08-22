/**
 * Read-state helpers for the messaging views.
 *
 * The server's thread GET is read-only: fetching a conversation no longer marks
 * it read. The views therefore decide for themselves whether an explicit
 * acknowledgement is worth sending, using the messages they already received —
 * no extra request, and no acknowledgement when there is nothing to acknowledge.
 *
 * `hasUnread` on a thread payload is only populated for LIST responses, so it
 * must not be used to make this decision on a detail payload.
 */

/**
 * True when the thread contains at least one message from `senderType` that the
 * viewer has not acknowledged yet.
 *
 * @param {{ messages?: Array<{ senderType?: string, readAt?: string | null }> } | null | undefined} thread
 * @param {"practice" | "patient"} senderType the OTHER party
 */
export function hasUnreadFrom(thread, senderType) {
  const messages = thread?.messages;
  if (!Array.isArray(messages)) return false;
  return messages.some((m) => m?.senderType === senderType && !m?.readAt);
}
