/**
 * Timeline rules of one conversation (Phase 3A).
 *
 * Pure functions on purpose. The read boundary and the merge decide what gets
 * acknowledged and what stays visible — rules worth testing without a browser,
 * and worth keeping out of a component that may be redesigned later.
 *
 * The server owns the total order (createdAt, id) and every page arrives in it,
 * oldest-first. Nothing here re-sorts; the client only ever joins ordered runs.
 */

/**
 * Joins two ordered runs of the same conversation into one timeline.
 *
 * `first` is the older run, `second` the newer one. Where the two overlap, the
 * newer copy of a message wins — a message whose read state changed between the
 * two responses keeps the fresher state — while its position stays the one it
 * already had. Identity is the message id and nothing else: never the body,
 * never the timestamp, both of which two distinct messages may share.
 *
 * @param {Array<{id: string}> | null | undefined} first
 * @param {Array<{id: string}> | null | undefined} second
 * @returns {Array<{id: string}>}
 */
export function mergeTimeline(first, second) {
  const byId = new Map();
  for (const m of first ?? []) if (m?.id) byId.set(m.id, m);
  for (const m of second ?? []) {
    if (!m?.id) continue;
    // set() on an existing key replaces the value but keeps the original
    // position, which is exactly what is wanted: fresher data, same place.
    byId.set(m.id, m);
  }
  return [...byId.values()];
}

/**
 * The read boundary: the newest message the viewer actually has on screen.
 *
 * This is what the client sends when acknowledging. It names a MESSAGE, never a
 * time and never "the thread": anything that arrives after this point is not
 * covered by it and stays unread, however long the acknowledgement takes to
 * reach the server.
 *
 * @param {Array<{id: string}> | null | undefined} messages oldest-first
 * @returns {string | null} null when there is nothing to acknowledge
 */
export function readBoundaryOf(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  return messages[messages.length - 1]?.id ?? null;
}

/**
 * The state to show on a message, or null when none should be shown.
 *
 * Only one's own messages carry a state — it answers "has the other side seen
 * this", which is meaningless on a received message. Two values only: there is
 * no delivery signal behind this channel, so none is claimed.
 *
 * @param {{senderType?: string, readAt?: string | null}} message
 * @param {"patient" | "practice"} ownSenderType the viewer's own side
 * @returns {"read" | "sent" | null}
 */
export function messageReadState(message, ownSenderType) {
  if (!message || message.senderType !== ownSenderType) return null;
  return message.readAt ? "read" : "sent";
}

/**
 * Puts ONE changed message back into the timeline.
 *
 * Editing and withdrawing answer with a single message, not a conversation.
 * Replacing that one entry keeps everything else — including pages of history
 * the reader loaded — instead of throwing the timeline away and fetching it
 * again. The message keeps its id and its position; only its content and state
 * differ.
 *
 * A message that is not in the timeline is not appended: it belongs to a
 * context this list is not showing, and inventing a place for it would put a
 * stranger's message on screen.
 *
 * @param {Array<{id: string}>} messages
 * @param {{id: string} | null | undefined} changed
 */
export function applyMessageUpdate(messages, changed) {
  if (!Array.isArray(messages) || !changed?.id) return messages ?? [];
  let found = false;
  const next = messages.map((m) => {
    if (m.id !== changed.id) return m;
    found = true;
    return changed;
  });
  return found ? next : messages;
}

/**
 * What the sender may still do with their own message.
 *
 * The server states this per message; the client only reads it. Anything the
 * client could compute here would be a second opinion, and a stale one — the
 * recipient may read the message a moment after the answer was written. The
 * mutation is refused server-side regardless of what this returns.
 *
 * @param {{canEdit?: boolean, canWithdraw?: boolean}} message
 */
export function messageActions(message) {
  return {
    canEdit: message?.canEdit === true,
    canWithdraw: message?.canWithdraw === true,
  };
}

/** True when the message was taken back and has no content left to show. */
export function isWithdrawn(message) {
  return Boolean(message?.withdrawnAt);
}

/** True when the message was changed after it was sent. */
export function isEdited(message) {
  return Boolean(message?.editedAt) && !isWithdrawn(message);
}
