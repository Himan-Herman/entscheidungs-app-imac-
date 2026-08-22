/**
 * Idempotency key for ONE logical send action.
 *
 * The server deduplicates by (thread, key), so a retry of the SAME action must
 * reuse its key while a genuinely new message must get a fresh one. That
 * distinction lives here rather than in the components: generate a key when the
 * user triggers a send, keep it across retries of that attempt, and drop it only
 * once the send has actually succeeded.
 *
 * Deliberately NOT derived from the message text — repeating yourself is
 * legitimate, and identical text under a new key is a new message.
 */
export function newSendRequestId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  }
  // Last resort for environments without WebCrypto; collisions only ever affect
  // the sender's own thread and at worst cost one deduplicated retry.
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
