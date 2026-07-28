/**
 * Context filter for practice reads of patient-owned medical data.
 *
 * A patient can be connected to several practices at once. Records they own
 * are either global — recorded outside any treatment context — or bound to one
 * concrete care relationship. A practice may see the global ones (with its own
 * consent) and the ones bound to ITS OWN link, and nothing else.
 *
 * The filter is built into the database query. Nothing is fetched and then
 * reduced in JavaScript, so a foreign record never reaches the process.
 *
 * Deny by default: only the two explicitly allowed shapes match. A record with
 * dataScope NULL — legacy, not yet classified — matches neither and is
 * therefore invisible to every practice until the backfill classifies it.
 */

/** The only scope values a practice read may ever match. */
export const PATIENT_GLOBAL = "patient_global";
export const PRACTICE_CONTEXTUAL = "practice_contextual";

/**
 * Prisma `where` for reading a patient's records through one care relationship.
 *
 * Both ids MUST come from the already-authorized link — never from a query
 * parameter or request body.
 *
 * @param {{ patientUserId: string, practicePatientLinkId: string, extraWhere?: object }} input
 */
export function buildPatientDataContextReadWhere(input) {
  const patientUserId = String(input?.patientUserId || "").trim();
  const practicePatientLinkId = String(input?.practicePatientLinkId || "").trim();

  // Refusing here rather than returning a permissive filter: a caller that
  // cannot name both is a programming error, and silently widening the query
  // is exactly the failure mode this service exists to prevent.
  if (!patientUserId || !practicePatientLinkId) {
    throw new Error("patient_data_context_read_requires_link");
  }

  return {
    ...(input.extraWhere ?? {}),
    userId: patientUserId,
    deletedAt: null,
    OR: [
      // A — the patient's own data, recorded outside any treatment context.
      { dataScope: PATIENT_GLOBAL, contextPracticePatientLinkId: null },
      // B — data recorded inside THIS care relationship.
      { dataScope: PRACTICE_CONTEXTUAL, contextPracticePatientLinkId: practicePatientLinkId },
      // C — another link's contextual data and D — unclassified legacy rows are
      // absent on purpose. Adding a branch for either would defeat the point.
    ],
  };
}

/**
 * Provenance for a practice-facing response.
 *
 * The scope is returned so a later UI can explain where a record came from.
 * The link id is NOT: a practice only ever sees its own link's records, so the
 * value would carry no information it does not already have, and returning it
 * would make foreign ids look like a legitimate field to send back.
 *
 * @param {{ dataScope?: string|null }} row
 */
export function practiceProvenanceJson(row) {
  return { dataScope: row?.dataScope ?? null };
}
