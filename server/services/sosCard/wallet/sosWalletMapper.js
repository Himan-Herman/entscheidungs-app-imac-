/**
 * SOS Wallet mapper — produces the MINIMAL payload a wallet pass may contain.
 *
 * PRODUCT RULE: the wallet pass is only an access carrier. It must contain at most:
 *   - a fixed title ("MedScoutX SOS")
 *   - the holder's initials (or name) — low-sensitivity identifier
 *   - optionally blood type, ONLY if the patient released it (showBloodType)
 *   - the emergency URL for the QR/barcode (NO health data in the code itself)
 *   - a self-reported notice
 *
 * No allergies, diagnoses, medications, implants, contacts, DOB, sex, pregnancy, height or
 * weight ever go into the pass. Those stay server-side, reachable only via the emergency page.
 */

/** "Maria Musterfrau" → "M. M." Falls back to "" when no name parts are present. */
export function initialsFrom(firstName, lastName) {
  const a = typeof firstName === "string" ? firstName.trim()[0] : "";
  const b = typeof lastName === "string" ? lastName.trim()[0] : "";
  return [a, b]
    .filter(Boolean)
    .map((c) => `${c.toUpperCase()}.`)
    .join(" ");
}

/**
 * @param {{
 *   card: object;                 // SosCard row (for showBloodType / bloodType only)
 *   firstName?: string;
 *   lastName?: string;
 *   emergencyUrl: string;         // the ONLY data encoded into the QR/barcode
 *   includeFullName?: boolean;    // default false → use initials (privacy-first)
 * }} input
 */
export function mapSosCardToWalletPayload({ card, firstName, lastName, emergencyUrl, includeFullName = false }) {
  const payload = {
    titleKey: "MedScoutX SOS",
    organizationName: "MedScoutX",
    holder: includeFullName
      ? [firstName, lastName].filter(Boolean).join(" ") || initialsFrom(firstName, lastName)
      : initialsFrom(firstName, lastName),
    // The barcode message is ONLY the URL — never health data.
    barcode: { format: "QR", message: emergencyUrl },
    emergencyUrl,
    selfReported: true,
  };

  // Blood type is the single optional medical hint, and only when explicitly released.
  if (card?.showBloodType && card?.bloodType) {
    payload.bloodType = card.bloodType;
  }

  return payload;
}
