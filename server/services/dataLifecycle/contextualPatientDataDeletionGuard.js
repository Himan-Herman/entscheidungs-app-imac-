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
 * A live document release into another practice stands in the way.
 *
 * Its own code, because it is a different situation with a different remedy:
 * the medical-record case needs archival, this one needs the release to be
 * withdrawn first. Like the code above it carries no counts, ids or content.
 */
export const ACTIVE_SHARING_BLOCKED = "document_sharing_requires_review";

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
 * Practice-ISSUED clinical artifacts (Phase 2F.3B).
 *
 * The four models above are patient-owned records that carry the relationship
 * they were created in. These two are the other direction: issued BY a practice
 * INTO a relationship. Until 2F.3B a medication plan simply cascaded away with
 * the practice and an e-prescription kept a dangling id; both now hold their
 * relationship with ON DELETE RESTRICT, which is why they belong here — a
 * database that refuses and a preflight that does not is the failure this
 * module exists to prevent.
 *
 * They scope by the link directly rather than by `contextPracticePatientLinkId`,
 * so they are counted separately from CONTEXTUAL_MODELS.
 */
const ISSUED_CLINICAL_MODELS = Object.freeze([
  { category: "medication_plans", delegate: "medicationPlan" },
  { category: "prescriptions", delegate: "erezeptEntry" },
]);

/**
 * Share grants are NOT clinical records — they are permission artifacts. They
 * carry ON DELETE RESTRICT foreign keys to PracticeProfile, PracticePatientLink
 * and User, so they block a hard delete just as firmly, but the right answer
 * differs by caller:
 *
 *   practice deletion — refuse, and say why (the grant is a live permission
 *                       held by a second practice; removing the granting
 *                       practice under it is not a silent operation),
 *   account deletion  — end them properly first, then delete, because the
 *                       patient explicitly asked for erasure.
 *
 * So they are counted separately from `blocked` and the caller decides. Before
 * this existed, neither caller knew about them and the database refused after
 * the preflight had already reported "fine" — the exact failure this module was
 * written to prevent.
 */

/**
 * @typedef {{ blocked: boolean, total: number, categories: string[], linkIds: string[],
 *             grantCount: number, requiresGrantCleanup: boolean }} BlockerReport
 */

/** @returns {BlockerReport} */
function emptyReport() {
  return {
    blocked: false,
    total: 0,
    categories: [],
    linkIds: [],
    grantCount: 0,
    requiresGrantCleanup: false,
  };
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

  // Issued artifacts name the link in their own column, not in a shared
  // `contextPracticePatientLinkId`, so they need their own query.
  const issuedCounts = await Promise.all(
    ISSUED_CLINICAL_MODELS.map(({ delegate }) =>
      client[delegate].count({
        where:
          delegate === "erezeptEntry"
            ? { linkId: { in: linkIds } }
            : { practicePatientLinkId: { in: linkIds } },
      }),
    ),
  );

  const categories = [
    ...CONTEXTUAL_MODELS.filter((_, i) => counts[i] > 0).map((m) => m.category),
    ...ISSUED_CLINICAL_MODELS.filter((_, i) => issuedCounts[i] > 0).map((m) => m.category),
  ];
  const total =
    counts.reduce((sum, n) => sum + n, 0) + issuedCounts.reduce((sum, n) => sum + n, 0);

  return {
    blocked: total > 0,
    total,
    categories,
    linkIds,
    grantCount: 0,
    requiresGrantCleanup: false,
  };
}

/**
 * Counts the share grants that a deletion would run into.
 *
 * Every RESTRICT path is covered, not just the obvious one: a grant names two
 * practices and two links, and any of the four can be the object being deleted.
 *
 * Counting only — no document title, no practice name.
 *
 * @param {{ practiceProfileIds?: string[], linkIds?: string[], userIds?: string[] }} scope
 * @param {object} client
 */
async function countGrantBlockers(scope, client) {
  const practiceIds = scope.practiceProfileIds ?? [];
  const linkIds = scope.linkIds ?? [];
  const userIds = scope.userIds ?? [];

  const or = [];
  if (practiceIds.length) {
    or.push({ sourcePracticeProfileId: { in: practiceIds } });
    or.push({ targetPracticeProfileId: { in: practiceIds } });
  }
  if (linkIds.length) {
    or.push({ sourcePracticePatientLinkId: { in: linkIds } });
    or.push({ targetPracticePatientLinkId: { in: linkIds } });
  }
  if (userIds.length) {
    or.push({ patientUserId: { in: userIds } });
    or.push({ grantedByUserId: { in: userIds } });
  }
  if (or.length === 0) return 0;

  // Every row counts, whatever its status: RESTRICT does not care whether a
  // grant is active or revoked, and a preflight that only counted active ones
  // would hand back the same false "fine" as before.
  return client.practiceDocumentShareGrant.count({ where: { OR: or } });
}

/** Merges a grant count into a contextual report. */
function withGrants(report, grantCount) {
  return {
    ...report,
    grantCount,
    requiresGrantCleanup: grantCount > 0,
    categories: grantCount > 0 ? [...report.categories, "document_share_grants"] : report.categories,
  };
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
  const linkIds = links.map((l) => l.id);

  const [contextual, grantCount] = await Promise.all([
    countBlockers(linkIds, client),
    countGrantBlockers({ practiceProfileIds: [id], linkIds }, client),
  ]);
  return withGrants({ ...contextual, linkIds }, grantCount);
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
  const linkIds = links.map((l) => l.id);

  const [contextual, grantCount] = await Promise.all([
    countBlockers(linkIds, client),
    countGrantBlockers(
      { userIds: [id], practiceProfileIds: ownedPracticeIds, linkIds },
      client,
    ),
  ]);
  return withGrants({ ...contextual, linkIds }, grantCount);
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

  const [contextual, grantCount] = await Promise.all([
    countBlockers([id], client),
    countGrantBlockers({ linkIds: [id] }, client),
  ]);
  return withGrants(contextual, grantCount);
}

/**
 * Audit metadata for a blocked attempt. Aggregate only: a count and coarse
 * category labels, never link ids, record ids or medical values.
 *
 * @param {BlockerReport} report
 */
export function blockerAuditMetadata(report) {
  return {
    blockedBy: report?.blocked ? "contextual_patient_data" : "document_share_grants",
    blockerCount: report.total,
    blockerCategories: [...report.categories],
    grantCount: report.grantCount ?? 0,
  };
}

/**
 * The stable code a caller should return, or null when nothing blocks.
 *
 * Kept here rather than in each route so the two situations can never drift
 * apart in how they are reported.
 *
 * @param {BlockerReport} report
 * @returns {string | null}
 */
export function blockingErrorCode(report) {
  if (report?.blocked) return CONTEXTUAL_DATA_BLOCKED;
  if (report?.requiresGrantCleanup) return ACTIVE_SHARING_BLOCKED;
  return null;
}
