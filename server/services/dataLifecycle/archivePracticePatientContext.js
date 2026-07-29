/**
 * Moves a patient's contextual medical records from a live care link to an
 * immutable archive context, immediately before that link is hard-deleted.
 *
 * Why this exists: every contextual VitalEntry, VaccinationEntry, AllergyEntry
 * and DiagnosisEntry holds an ON DELETE RESTRICT foreign key to its link. That
 * is deliberate — a medical record must not silently lose its origin — but it
 * made practice deletion impossible. Archiving is the only sanctioned way out.
 *
 * What it never does: delete a medical record, change its dataScope, re-label
 * it as the patient's own global data, copy any medical content, or invent a
 * practice. A record keeps everything except which link it points at.
 *
 * The caller owns the transaction. This function refuses to open one, because
 * archiving is only ever correct as part of the same atomic step that performs
 * the deletion — a committed archive with a surviving link would leave records
 * detached from a practice that still exists.
 */

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

/** The four patient-owned models that carry a practice context. */
export const CONTEXTUAL_MODELS = Object.freeze([
  "vitalEntry",
  "vaccinationEntry",
  "allergyEntry",
  "diagnosisEntry",
]);

export const ARCHIVE_REASONS = Object.freeze({
  PRACTICE_DELETED: "practice_deleted",
  OWNER_ACCOUNT_DELETED: "owner_account_deleted",
});

/** Stable internal codes. None of them reaches an HTTP response verbatim. */
export const ARCHIVE_CONFLICT = "context_archive_conflict";
export const ARCHIVE_INCOMPLETE = "context_archive_incomplete";

function archiveError(code, detail) {
  const err = new Error(code);
  err.archiveDetail = detail;
  return err;
}

/**
 * Locks the given links FOR UPDATE, in a fixed order.
 *
 * The contextual write path takes FOR SHARE on the same row, so the two
 * serialise against each other: a write that is already running finishes before
 * archiving sees the link, and a write that starts later waits until the
 * archiving transaction commits — at which point the link is gone and the
 * write's own link check fails. Ordering by id keeps two concurrent archive
 * runs from deadlocking on overlapping link sets.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string[]} linkIds
 */
async function lockLinks(tx, linkIds) {
  return tx.$queryRaw`
    SELECT "id", "patientUserId", "practiceProfileId", "status"
    FROM "PracticePatientLink"
    WHERE "id" = ANY(${linkIds})
    ORDER BY "id"
    FOR UPDATE
  `;
}

/**
 * Creates or reuses the archive context for one former link.
 *
 * originalPracticePatientLinkId is unique, which makes this idempotent: a
 * retried deletion finds the existing context instead of creating a second one.
 * A context that exists but describes a different patient or practice is a
 * contradiction we refuse to resolve by overwriting.
 */
async function ensureArchiveContext(tx, { link, practice, archiveReason }) {
  const existing = await tx.archivedPracticePatientContext.findUnique({
    where: { originalPracticePatientLinkId: link.id },
  });

  if (existing) {
    if (existing.patientUserId !== link.patientUserId
      || existing.originalPracticeProfileId !== link.practiceProfileId) {
      throw archiveError(ARCHIVE_CONFLICT, "existing archive describes a different context");
    }
    // A different reason is acceptable — the same link can be reached by a
    // practice deletion and by the owner deleting their account — but the
    // stored reason is never overwritten.
    return existing;
  }

  try {
    return await tx.archivedPracticePatientContext.create({
      data: {
        patientUserId: link.patientUserId,
        originalPracticePatientLinkId: link.id,
        originalPracticeProfileId: link.practiceProfileId,
        // What the patient knew the practice as, frozen at deletion time.
        practiceDisplayNameSnapshot: practice?.displayNameForPatients ?? practice?.practiceName ?? null,
        practiceSpecialtySnapshot: practice?.specialty ?? null,
        archiveReason,
      },
    });
  } catch (err) {
    // A concurrent archiving run won the unique index; use its row.
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await tx.archivedPracticePatientContext.findUnique({
        where: { originalPracticePatientLinkId: link.id },
      });
      if (raced) return raced;
    }
    throw err;
  }
}

/**
 * Archives every contextual record of the given links.
 *
 * @param {{
 *   transaction: import('@prisma/client').Prisma.TransactionClient,
 *   linkIds: string[],
 *   archiveReason: string,
 *   expectedPracticeProfileId?: string,
 * }} input
 * @returns {Promise<{ archivedLinks: number, movedByModel: Record<string, number>, movedTotal: number }>}
 */
export async function archiveContextualPatientDataForLinks(input) {
  const tx = input?.transaction;
  if (!tx || typeof tx.$queryRaw !== "function") {
    throw archiveError(ARCHIVE_INCOMPLETE, "an open transaction client is required");
  }
  const archiveReason = String(input?.archiveReason || "").trim();
  if (!Object.values(ARCHIVE_REASONS).includes(archiveReason)) {
    throw archiveError(ARCHIVE_CONFLICT, "unknown archive reason");
  }

  const linkIds = [...new Set(
    (Array.isArray(input?.linkIds) ? input.linkIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  )].sort();

  const movedByModel = Object.fromEntries(CONTEXTUAL_MODELS.map((m) => [m, 0]));
  if (linkIds.length === 0) {
    // A practice with no links is a perfectly ordinary case, not an error.
    return { archivedLinks: 0, movedByModel, movedTotal: 0 };
  }

  const locked = await lockLinks(tx, linkIds);
  if (locked.length !== linkIds.length) {
    throw archiveError(ARCHIVE_CONFLICT, "a link disappeared between selection and locking");
  }

  for (const link of locked) {
    if (!link.patientUserId || !link.practiceProfileId) {
      throw archiveError(ARCHIVE_CONFLICT, "link without patient or practice");
    }
    // The caller names the practice; a link that belongs elsewhere must never be
    // swept into this deletion.
    if (input.expectedPracticeProfileId
      && link.practiceProfileId !== input.expectedPracticeProfileId) {
      throw archiveError(ARCHIVE_CONFLICT, "link belongs to a different practice");
    }
  }

  const practiceIds = [...new Set(locked.map((l) => l.practiceProfileId))];
  const practices = await tx.practiceProfile.findMany({
    where: { id: { in: practiceIds } },
    select: { id: true, practiceName: true, displayNameForPatients: true, specialty: true },
  });
  const practiceById = new Map(practices.map((p) => [p.id, p]));

  let archivedLinks = 0;

  for (const link of locked) {
    const pending = {};
    let pendingTotal = 0;
    for (const model of CONTEXTUAL_MODELS) {
      pending[model] = await tx[model].count({
        where: {
          dataScope: "practice_contextual",
          contextPracticePatientLinkId: link.id,
          archivedPracticeContextId: null,
        },
      });
      pendingTotal += pending[model];
    }

    // A link with nothing to move needs no archive. Creating one would leave an
    // archive context behind that no record ever points at — an orphan whose
    // only content is the name of a practice that no longer exists.
    if (pendingTotal === 0) continue;

    const archive = await ensureArchiveContext(tx, {
      link,
      practice: practiceById.get(link.practiceProfileId),
      archiveReason,
    });
    archivedLinks += 1;

    for (const model of CONTEXTUAL_MODELS) {
      const where = {
        dataScope: "practice_contextual",
        contextPracticePatientLinkId: link.id,
        archivedPracticeContextId: null,
        // Soft-deleted records are archived too: deletedAt hides a record from
        // the patient's list, it does not remove it, and leaving it behind
        // would keep the RESTRICT in place.
      };

      const before = pending[model];
      const updated = await tx[model].updateMany({
        where,
        // Only the two context fields. dataScope, userId, the medical values,
        // createdAt, deletedAt and the source fields are untouched.
        data: { contextPracticePatientLinkId: null, archivedPracticeContextId: archive.id },
      });

      if (updated.count !== before) {
        throw archiveError(
          ARCHIVE_INCOMPLETE,
          `${model}: moved ${updated.count} of ${before}`,
        );
      }
      movedByModel[model] += updated.count;
    }

    // Nothing contextual may still point at the link we are about to delete.
    for (const model of CONTEXTUAL_MODELS) {
      const leftover = await tx[model].count({
        where: { contextPracticePatientLinkId: link.id },
      });
      if (leftover > 0) {
        throw archiveError(ARCHIVE_INCOMPLETE, `${model}: ${leftover} rows still on the live link`);
      }
    }
  }

  const movedTotal = Object.values(movedByModel).reduce((a, b) => a + b, 0);
  return { archivedLinks, movedByModel, movedTotal };
}

/**
 * Ends every document share grant that touches this practice, in either
 * direction, and revokes the download tokens issued under them.
 *
 * A grant holds RESTRICT foreign keys to the practice, to the link and to the
 * document, so it blocks the deletion three times over. The grants are revoked
 * first — so the revocation is a real, dated event rather than an implicit
 * consequence — and only then removed.
 *
 * The audit trail is written by the caller from the returned counts; nothing
 * here reads a document title, file name or storage key.
 *
 * @param {{ transaction: any, practiceProfileId: string }} input
 */
export async function releaseDocumentShareGrantsForPractice(input) {
  const tx = input?.transaction;
  const practiceProfileId = String(input?.practiceProfileId || "").trim();
  if (!tx || !practiceProfileId) {
    throw archiveError(ARCHIVE_INCOMPLETE, "transaction and practice are required");
  }

  const touching = {
    OR: [
      { sourcePracticeProfileId: practiceProfileId },
      { targetPracticeProfileId: practiceProfileId },
    ],
  };

  const affected = await tx.practiceDocumentShareGrant.findMany({
    where: touching,
    select: {
      id: true,
      documentId: true,
      status: true,
      sourcePracticeProfileId: true,
      targetPracticeProfileId: true,
      targetPracticePatientLinkId: true,
    },
  });

  const now = new Date();
  const asTarget = affected.filter((g) => g.targetPracticeProfileId === practiceProfileId);
  const asSource = affected.filter((g) => g.sourcePracticeProfileId === practiceProfileId);
  const activeCount = affected.filter((g) => g.status === "active").length;

  const revoked = await tx.practiceDocumentShareGrant.updateMany({
    where: { ...touching, status: "active" },
    data: { status: "revoked", revokedAt: now },
  });

  // Every practice-audience token issued for a document that was reachable
  // through one of these grants, plus every token this practice itself holds.
  const tokenWhere = {
    revokedAt: null,
    OR: [
      { practiceProfileId },
      {
        audience: "practice",
        documentId: { in: [...new Set(affected.map((g) => g.documentId))] },
        practicePatientLinkId: { in: [...new Set(asTarget.map((g) => g.targetPracticePatientLinkId))] },
      },
    ],
  };
  const tokens = await tx.secureDocumentAccessToken.updateMany({
    where: tokenWhere,
    data: { revokedAt: now },
  });

  // The grant rows themselves must go: their RESTRICT keys to the practice, the
  // link and the document would otherwise block the deletion. This is the only
  // place a grant is removed rather than revoked, and it happens exclusively as
  // part of deleting the practice it belongs to.
  const removed = await tx.practiceDocumentShareGrant.deleteMany({ where: touching });

  return {
    grantsTouched: affected.length,
    grantsAsTarget: asTarget.length,
    grantsAsSource: asSource.length,
    grantsActiveBefore: activeCount,
    grantsRevoked: revoked.count,
    grantsRemoved: removed.count,
    tokensRevoked: tokens.count,
  };
}

/**
 * Deletes one practice, archiving the contextual records of its patients first.
 *
 * This is the single implementation both the practice route and the account
 * erasure use. Neither may reimplement archiving, grant release or the guard:
 * a second copy is how the two paths would drift apart.
 *
 * The caller owns the transaction. Locking order is fixed and identical in both
 * callers — user, then practice, then links by id — so the two deletion paths
 * cannot deadlock against each other.
 *
 * @param {{
 *   transaction: any,
 *   practiceProfileId: string,
 *   deletionReason: string,
 *   deletingUserId: string,
 * }} input
 */
export async function deletePracticeWithArchivedContext(input) {
  const tx = input?.transaction;
  const practiceProfileId = String(input?.practiceProfileId || "").trim();
  if (!tx || !practiceProfileId) {
    throw archiveError(ARCHIVE_INCOMPLETE, "transaction and practice are required");
  }

  const practiceRows = await tx.$queryRaw`
    SELECT "id" FROM "PracticeProfile" WHERE "id" = ${practiceProfileId} FOR UPDATE
  `;
  if (practiceRows.length === 0) throw new Error("practice_not_found");

  const links = await tx.practicePatientLink.findMany({
    where: { practiceProfileId },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const archived = await archiveContextualPatientDataForLinks({
    transaction: tx,
    linkIds: links.map((l) => l.id),
    archiveReason: input.deletionReason,
    expectedPracticeProfileId: practiceProfileId,
  });

  const grants = await releaseDocumentShareGrantsForPractice({
    transaction: tx,
    practiceProfileId,
  });

  // The existing guard, as a postcondition: anything the archiving did not
  // cover rolls the transaction back instead of failing deep in the database.
  const { checkPracticeDeletionBlockers, CONTEXTUAL_DATA_BLOCKED } =
    await import("./contextualPatientDataDeletionGuard.js");
  const blockers = await checkPracticeDeletionBlockers(practiceProfileId, tx);
  if (blockers.blocked) {
    const err = new Error(CONTEXTUAL_DATA_BLOCKED);
    err.blockerReport = blockers;
    throw err;
  }

  const deleted = await tx.practiceProfile.deleteMany({ where: { id: practiceProfileId } });
  if (deleted.count === 0) throw new Error("practice_not_found");

  return { archived, grants };
}

/**
 * Ends every share grant the user is personally part of — as the patient, as
 * the granting user, or through a link of theirs on either side — and revokes
 * the tokens issued under them.
 *
 * Grants belonging to practices the user owns are handled by
 * deletePracticeWithArchivedContext; this covers the user as a PATIENT. A grant
 * in which neither the user nor their practices appear is never touched.
 *
 * @param {{ transaction: any, patientUserId: string }} input
 */
export async function releaseDocumentShareGrantsForPatient(input) {
  const tx = input?.transaction;
  const patientUserId = String(input?.patientUserId || "").trim();
  if (!tx || !patientUserId) {
    throw archiveError(ARCHIVE_INCOMPLETE, "transaction and patient are required");
  }

  const touching = {
    OR: [{ patientUserId }, { grantedByUserId: patientUserId }],
  };

  const affected = await tx.practiceDocumentShareGrant.findMany({
    where: touching,
    select: { id: true, documentId: true, status: true },
  });
  if (affected.length === 0) {
    return { grantsTouched: 0, grantsRevoked: 0, grantsRemoved: 0, tokensRevoked: 0 };
  }

  const now = new Date();
  const revoked = await tx.practiceDocumentShareGrant.updateMany({
    where: { ...touching, status: "active" },
    data: { status: "revoked", revokedAt: now },
  });
  const tokens = await tx.secureDocumentAccessToken.updateMany({
    where: {
      revokedAt: null,
      documentId: { in: [...new Set(affected.map((g) => g.documentId))] },
    },
    data: { revokedAt: now },
  });
  const removed = await tx.practiceDocumentShareGrant.deleteMany({ where: touching });

  return {
    grantsTouched: affected.length,
    grantsRevoked: revoked.count,
    grantsRemoved: removed.count,
    tokensRevoked: tokens.count,
  };
}

/**
 * Removes the user's OWN patient-owned medical records and the archive contexts
 * that then have nothing pointing at them.
 *
 * This is the patient's own data, and the product decision for account erasure
 * is that it goes with the account. Archiving it first and deleting it a moment
 * later would be pointless work on medical data.
 *
 * Nothing is read: counts, deleteMany and a verification count only. No record
 * id and no medical value is ever loaded or logged.
 *
 * @param {{ transaction: any, patientUserId: string }} input
 */
export async function deleteOwnPatientDataForUser(input) {
  const tx = input?.transaction;
  const patientUserId = String(input?.patientUserId || "").trim();
  if (!tx || !patientUserId) {
    throw archiveError(ARCHIVE_INCOMPLETE, "transaction and patient are required");
  }

  const removedByModel = {};
  for (const model of CONTEXTUAL_MODELS) {
    // Every scope and state: global, live contextual, already archived, and
    // soft-deleted. deletedAt hides a record, it does not remove it.
    const removed = await tx[model].deleteMany({ where: { userId: patientUserId } });
    removedByModel[model] = removed.count;
  }

  for (const model of CONTEXTUAL_MODELS) {
    const left = await tx[model].count({ where: { userId: patientUserId } });
    if (left > 0) {
      throw archiveError(ARCHIVE_INCOMPLETE, `${model}: ${left} own records remain`);
    }
  }

  // Only now can the user's own archive contexts go: the four models hold a
  // RESTRICT to them, so this order is required, not merely tidy. Other
  // patients' archive contexts are never touched.
  const archivesRemoved = await tx.archivedPracticePatientContext.deleteMany({
    where: { patientUserId },
  });

  const removedTotal = Object.values(removedByModel).reduce((a, b) => a + b, 0);
  return { removedByModel, removedTotal, archivesRemoved: archivesRemoved.count };
}
