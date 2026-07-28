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
