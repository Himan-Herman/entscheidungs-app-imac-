/**
 * Where a PRACTICE inbox notice leads.
 *
 * Split out of the notification centre so the inbox serializer and the header
 * preview share ONE derivation. Two copies of a URL policy is how one of them
 * quietly stops matching the other.
 *
 * The patient side has had this since its own inbox was built
 * (patientInboxTargets.js); this is the practice counterpart.
 */

import { safeInternalPath } from "../patientInbox/patientInboxTargets.js";

/**
 * Where a PRACTICE inbox notice leads.
 *
 * The practice list serializer hands the stored `targetUrl` through unchanged.
 * For a header preview that is not good enough: a stored path is written once
 * and never revisited, so a renamed route leaves a dead link, and the value
 * itself has never been validated as same-origin. The patient side already
 * solved this by reconstructing known kinds at read time; the same policy is
 * applied here.
 *
 * Link-scoped destinations are built from the link the item already carries —
 * the row's own scope — so a preview can never point into another
 * relationship.
 *
 * @param {{ sourceRefType?: string, sourceRefId?: string, targetUrl?: string,
 *           practicePatientLinkId?: string, practiceProfileId?: string }} row
 * @returns {string | null}
 */
export function practiceInboxTargetUrl(row) {
  const linkId = String(row?.practicePatientLinkId ?? "").trim();
  const practiceId = String(row?.practiceProfileId ?? "").trim();

  // Anything tied to one care relationship opens that relationship, in the
  // practice context it belongs to. Both routes are real: /practice/patients
  // /:linkId and /practice/patients/:linkId/messages.
  //
  // The kinds the producers actually write are thread, data_request,
  // follow_up, practice_document, medication_plan, practice_patient_link,
  // previsit_session and telemedicine_session. Only the conversation has a
  // destination of its own; the rest belong on the patient record — and an
  // unknown future kind lands there too, rather than nowhere.
  if (linkId) {
    const q = practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : "";
    const path =
      row?.sourceRefType === "thread" || row?.sourceRefType === "message"
        ? `/practice/patients/${encodeURIComponent(linkId)}/messages`
        : `/practice/patients/${encodeURIComponent(linkId)}`;
    return `${path}${q}`;
  }

  // Not relationship-bound — the stored path is all there is, so it is used
  // only if it is a same-origin path. An absolute or protocol-relative value
  // is dropped rather than handed to the browser.
  return safeInternalPath(row?.targetUrl);
}
