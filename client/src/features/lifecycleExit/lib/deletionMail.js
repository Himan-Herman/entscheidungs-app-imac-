/**
 * Builds the prefilled confirmation e-mail for a practice deletion request.
 * Pure function so the mandatory tests can pin: recipient is the official
 * support address, the subject carries the case number, and the body contains
 * nothing beyond practice name, case number, owner address and owner name —
 * never patient names, diagnoses, document titles or internal ids.
 *
 * Opening the resulting mailto link is NOT treated as sending anywhere in the
 * UI — the note next to the button says so explicitly.
 */
export function buildDeletionMail({ t, supportEmail, practiceName, caseNumber, ownerEmail, ownerName }) {
  const subject = t.mailSubject.replace("{requestId}", caseNumber ?? "");
  const body = t.mailBody
    .replace("{practiceName}", practiceName || "")
    .replace("{requestId}", caseNumber ?? "")
    .replace("{ownerEmail}", ownerEmail || "")
    .replace("{ownerName}", ownerName || "");
  const href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { subject, body, href };
}
