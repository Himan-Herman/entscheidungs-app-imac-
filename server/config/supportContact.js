/**
 * Official MedScoutX contact address for lifecycle correspondence.
 *
 * Deliberately a separate module from services/startup/destructiveDeletionGate.js:
 * that module owns ENABLE_DESTRUCTIVE_PRACTICE_DELETION and stays the single
 * interpretation of the destructive release gate. This one owns nothing but
 * the reply-to / support address.
 */
export function getSupportEmail() {
  const raw = process.env.SUPPORT_EMAIL;
  const value = typeof raw === "string" ? raw.trim() : "";
  return value || "contact@medscoutx.com";
}
