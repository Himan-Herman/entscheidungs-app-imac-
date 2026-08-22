/**
 * WHICH PERSON a care relationship is for.
 *
 * One account can hold several links to the same practice, because the
 * uniqueness key is (practiceProfileId, patientUserId, patientProfileId). Those
 * are separate contexts — separate messages, appointments, documents and
 * medication plans — but they carry the same practice name, specialty and city,
 * so on screen they were indistinguishable. Opening the wrong one shows real,
 * authorized data about the wrong person.
 *
 * `patientProfileName` is null exactly when the relationship is the account
 * holder's own: a PatientProfile row exists only for a family profile.
 *
 * The label is shown for BOTH cases rather than only for family profiles. If
 * only the family case were labelled, the account holder's own relationship
 * would be identified by the absence of a line — and absence is a poor signal
 * to hang a medication plan on. Every relationship says who it is for.
 *
 * @param {string | null | undefined} patientProfileName
 * @param {Record<string, string>} t practiceContext messages
 * @returns {string}
 */
export function patientContextLabel(patientProfileName, t) {
  const name = String(patientProfileName ?? "").trim();
  if (!name) return t.contextOwnAccount;
  return t.contextForProfile.replace("{name}", name);
}

/**
 * Comparison text for the chooser search.
 *
 * Kept next to the label so the two can never drift: what a patient reads on a
 * card is what they can search for. The account-holder wording travels through
 * `t`, so searching "eigenes" works in German and "own" in English.
 *
 * @param {object} context
 * @param {Record<string, string>} t
 */
export function patientContextSearchText(context, t) {
  return patientContextLabel(context?.patientProfileName, t);
}

/**
 * Stable ordering between two otherwise identical practice cards.
 *
 * Without this the comparator returns 0 for two links to the same practice and
 * the order falls back to whatever the database happened to return. The profile
 * name decides first because it is what the patient sees; `linkId` is the final
 * tie-break and is never displayed — it only guarantees the list does not
 * reshuffle between renders.
 *
 * @param {object} a
 * @param {object} b
 */
export function comparePatientContextTieBreak(a, b) {
  const an = String(a?.patientProfileName ?? "");
  const bn = String(b?.patientProfileName ?? "");
  if (an !== bn) return an.localeCompare(bn);
  return String(a?.linkId ?? "").localeCompare(String(b?.linkId ?? ""));
}
