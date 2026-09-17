/**
 * Telling the header badge that the unread count has changed.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 * The notification centre owns the unread number. It fetches it once, on
 * login and on a mode or practice switch, and has no way to learn that
 * something changed in between. So a practice member could open the one unread
 * inbox item, watch it turn from "Neu" to "Gelesen", and still see a red 1 in
 * the header until they reloaded the page.
 *
 * ── Why a signal and not a shared counter ───────────────────────────────────
 * The obvious fix is to lift the number into a context and let both places
 * write it. That creates two writers for one truth, and the moment they
 * disagree the badge starts lying in a way nobody can trace.
 *
 * So the number keeps exactly one owner. This module carries no count and no
 * state — it only says "something you counted has changed", and the owner goes
 * and asks the server again. One writer, one source, no arithmetic in two
 * places that has to agree.
 *
 * ── Why the window ──────────────────────────────────────────────────────────
 * The pages that mark items read are not children of the notification centre —
 * they sit in different route subtrees, so no React context reaches from one
 * to the other without hoisting state to the root. A DOM event costs nothing
 * and needs no provider. If a shared notification context ever arrives, this
 * module is the single place both sides go through, so moving them is one
 * edit rather than a search.
 */

/** The event name. Not exported: everything goes through the two functions. */
const EVENT = "medscoutx:unread-changed";

/**
 * Announces that the unread count may have changed.
 *
 * Call after a mutation the server has CONFIRMED. Announcing optimistically
 * would have the badge re-fetch a number that has not moved yet, which is
 * harmless but pointless, or move it back on a failure, which is not.
 */
export function notifyUnreadChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * Listens for that announcement.
 *
 * @param {() => void} handler
 * @returns {() => void} unsubscribe — call it on unmount
 */
export function onUnreadChanged(handler) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
