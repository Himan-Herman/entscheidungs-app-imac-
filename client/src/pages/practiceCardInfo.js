/**
 * Pure helpers for the practice-hub card info overlay.
 * Kept framework-free so the "info click must NOT open the tile" guarantee and
 * the "which card has an info button" rule can be unit-tested (node --test).
 */

/**
 * Per-card info-overlay config for the practice hub.
 * Holds only i18n KEY NAMES + a stable DOM id (never translated strings), so
 * this file stays framework-free and node --test friendly; the page resolves
 * the keys against the active locale at render time. `paragraphKeys` are shown
 * in order inside the modal body.
 */
export const CARD_INFO = {
  telemedicine: {
    titleId: "practice-card-info-telemedicine-title",
    buttonKey: "cardTelemedicineInfoButton",
    titleKey: "cardTelemedicineInfoTitle",
    paragraphKeys: [
      "cardTelemedicineInfoIntro",
      "cardTelemedicineInfoUsage",
      "cardTelemedicineInfoPrivacy",
    ],
  },
  inbox: {
    titleId: "practice-card-info-inbox-title",
    buttonKey: "cardInboxInfoButton",
    titleKey: "cardInboxInfoTitle",
    paragraphKeys: [
      "cardInboxInfoIntro",
      "cardInboxInfoUsage",
      "cardInboxInfoConnection",
      "cardInboxInfoAlpha",
    ],
  },
};

/** Card ids that show an info (ⓘ) button + explanation modal. */
export const INFO_CARD_IDS = Object.keys(CARD_INFO);

/** @param {string} cardId */
export function hasCardInfo(cardId) {
  return Object.prototype.hasOwnProperty.call(CARD_INFO, cardId);
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
