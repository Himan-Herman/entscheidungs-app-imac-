/**
 * Preflight guard for hard deletes that would remove a PracticePatientLink.
 *
 * Patient-owned medical records may be classified as `practice_contextual`,
 * in which case they carry a foreign key to the care relationship they were
 * created in. That foreign key is ON DELETE RESTRICT: the origin of a medical
 * record must never be silently dropped. Without a preflight, deleting a
 * practice or an account would fail deep inside the database with a raw
 * constraint error and a 500.
 *
 * This module answers one question, server-side, before anything is deleted:
 * would this deletion orphan a contextual medical record?
 *
 * PRIVACY: it counts, it never reads content. Callers get a total, a list of
 * affected data categories and (internally) the link ids. None of that may be
 * put into an API response — see the route handlers, which return a stable
 * error code only.
 *
 * DEPLOYMENT: the columns this reads exist only after migration
 * 20260728090000_add_patient_data_context. Running this code against a database
 * without that migration raises "column does not exist" — the documented
 * migration-before-code order applies.
 */

import { prisma as defaultClient } from "../../lib/prisma.js";

/** Stable error code returned to clients. Deliberately carries no detail. */
export const CONTEXTUAL_DATA_BLOCKED = "contextual_patient_data_requires_archival";

/**
 * The four patient-owned models that can carry a care-relationship context.
 * `category` is a coarse label safe for audit metadata — never a record id.
 */
const CONTEXTUAL_MODELS = Object.freeze([
  { category: "vitals", delegate: "vitalEntry" },
  { category: "vaccinations", delegate: "vaccinationEntry" },
  { category: "allergies", delegate: "allergyEntry" },
  { category: "diagnoses", delegate: "diagnosisEntry" },
]);

/**
 * @typedef {{ blocked: boolean, total: number, categories: string[], linkIds: string[] }} BlockerReport
 */

/** @returns {BlockerReport} */
function emptyReport() {
  return { blocked: false, total: 0, categories: [], linkIds: [] };
}

/**
 * Counts contextual records pointing at any of the given links.
 * Counting only — no record content is selected.
 *
 * @param {string[]} linkIds
 * @param {object} client Prisma client or transaction client
 * @returns {Promise<BlockerReport>}
 */
async function countBlockers(linkIds, client) {
  if (!Array.isArray(linkIds) || linkIds.length === 0) return emptyReport();

  const where = {
    dataScope: "practice_contextual",
    contextPracticePatientLinkId: { in: linkIds },
  };

  const counts = await Promise.all(
    CONTEXTUAL_MODELS.map(({ delegate }) => client[delegate].count({ where })),
  );

  const categories = CONTEXTUAL_MODELS.filter((_, i) => counts[i] > 0).map((m) => m.category);
  const total = counts.reduce((sum, n) => sum + n, 0);

  return { blocked: total > 0, total, categories, linkIds };
}

/**
 * Would deleting this practice orphan contextual medical records?
 * Covers every care relationship the practice holds.
 *
 * @param {string} practiceProfileId
 * @param {object} [client]
 * @returns {Promise<BlockerReport>}
 */
export async function checkPracticeDeletionBlockers(practiceProfileId, client = defaultClient) {
  const id = String(practiceProfileId || "").trim();
  if (!id) return emptyReport();

  const links = await client.practicePatientLink.findMany({
    where: { practiceProfileId: id },
    select: { id: true },
  });
  return countBlockers(links.map((l) => l.id), client);
}

/**
 * Would deleting this account orphan contextual medical records?
 *
 * Two independent routes reach a link from a user:
 *   - the user is the PATIENT of the link
 *   - the user OWNS a practice, whose links cascade when the practice goes
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<BlockerReport>}
 */
export async function checkUserDeletionBlockers(userId, client = defaultClient) {
  const id = String(userId || "").trim();
  if (!id) return emptyReport();

  const ownedPractices = await client.practiceProfile.findMany({
    where: { userId: id },
    select: { id: true },
  });
  const ownedPracticeIds = ownedPractices.map((p) => p.id);

  const links = await client.practicePatientLink.findMany({
    where: {
      OR: [
        { patientUserId: id },
        ...(ownedPracticeIds.length ? [{ practiceProfileId: { in: ownedPracticeIds } }] : []),
      ],
    },
    select: { id: true },
  });
  return countBlockers(links.map((l) => l.id), client);
}

/**
 * Would deleting this single care relationship orphan contextual records?
 *
 * @param {string} linkId
 * @param {object} [client]
 * @returns {Promise<BlockerReport>}
 */
export async function checkPracticePatientLinkDeletionBlockers(linkId, client = defaultClient) {
  const id = String(linkId || "").trim();
  if (!id) return emptyReport();
  return countBlockers([id], client);
}

/**
 * Audit metadata for a blocked attempt. Aggregate only: a count and coarse
 * category labels, never link ids, record ids or medical values.
 *
 * @param {BlockerReport} report
 */
export function blockerAuditMetadata(report) {
  return {
    blockedBy: "contextual_patient_data",
    blockerCount: report.total,
    blockerCategories: [...report.categories],
  };
}
