/**
 * Pure helpers for the practice-hub card info overlay.
 * Kept framework-free so the "info click must NOT open the tile" guarantee and
 * the "which card has an info button" rule can be unit-tested (node --test).
 */

/** Card ids that show an info (ⓘ) button + explanation modal. */
export const INFO_CARD_IDS = ["telemedicine"];

/** @param {string} cardId */
export function hasCardInfo(cardId) {
  return INFO_CARD_IDS.includes(cardId);
}

/**
 * Stop a click on the info button from triggering the surrounding card link
 * (navigation). Safe to call with a partial/missing event.
 * @param {{ preventDefault?: () => void, stopPropagation?: () => void }} [event]
 */
export function suppressCardNavigation(event) {
  if (!event) return;
  if (typeof event.preventDefault === "function") event.preventDefault();
  if (typeof event.stopPropagation === "function") event.stopPropagation();
}
