/**
 * Patient-controlled release of a single practice document to one other
 * connected practice.
 *
 * The patient is the only actor. A practice cannot create, activate or extend a
 * grant — not the owner, not an admin, not a doctor — and the database enforces
 * that independently via CHECK ("patientUserId" = "grantedByUserId").
 *
 * A grant is READ only, and it is a relation, never a copy: no second document,
 * no second file, no second OCR run.
 */

import { prisma } from "../../lib/prisma.js";
import { writeAuditLog, writeRequiredAuditLog } from "../auditLogService.js";

export const GRANT_STATUS = Object.freeze({
  ACTIVE: "active",
  REVOKED: "revoked",
  EXPIRED: "expired",
});

/** Link states in which a practice may act on a patient's data at all. */
const LINK_USABLE = new Set(["invited", "active"]);

/** The only field a patient may send when creating a grant. */
const ALLOWED_CREATE_FIELDS = new Set(["targetPracticePatientLinkId"]);

function err(code) {
  return new Error(code);
}

/**
 * Rejects any attempt to steer the grant from the request body.
 *
 * Every other field of a grant is derived by the server from the document and
 * the target link. Silently ignoring an extra field would leave a caller
 * believing they had set it, so an unexpected key is an error, not noise.
 *
 * @param {Record<string, unknown>} body
 */
export function assertOnlyAllowedCreateFields(body) {
  const keys = Object.keys(body ?? {});
  const rejected = keys.filter((k) => !ALLOWED_CREATE_FIELDS.has(k));
  if (rejected.length > 0) throw err("unsupported_field");
}

/**
 * Is this grant effective right now?
 *
 * Used for in-memory checks. The database-side equivalent is
 * effectiveGrantWhere() below; both must agree, so they are kept adjacent.
 *
 * @param {{ status?: string, revokedAt?: Date|null, expiresAt?: Date|null }} grant
 */
export function isGrantEffective(grant, now = new Date()) {
  if (!grant || grant.status !== GRANT_STATUS.ACTIVE) return false;
  if (grant.revokedAt) return false;
  if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Prisma `where` for a grant that currently gives THIS practice, through THIS
 * link, read access to a document belonging to THIS patient.
 *
 * All three ids come from the already-authorized link — never from the request.
 * A grant id alone grants nothing: it is not part of the filter.
 *
 * @param {{ targetPracticePatientLinkId: string, targetPracticeProfileId: string, patientUserId: string, now?: Date }} input
 */
export function effectiveGrantWhere(input) {
  const linkId = String(input?.targetPracticePatientLinkId || "").trim();
  const practiceId = String(input?.targetPracticeProfileId || "").trim();
  const patientUserId = String(input?.patientUserId || "").trim();

  // Refusing beats returning a permissive filter: a caller that cannot name all
  // three is a programming error, and widening the query is the exact failure
  // this function exists to prevent.
  if (!linkId || !practiceId || !patientUserId) {
    throw err("grant_filter_requires_link");
  }

  const now = input.now ?? new Date();
  return {
    targetPracticePatientLinkId: linkId,
    targetPracticeProfileId: practiceId,
    patientUserId,
    status: GRANT_STATUS.ACTIVE,
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

/**
 * Prisma `where` for every document THIS practice may read through THIS link.
 *
 * Exactly two shapes match:
 *   A — the practice's own document on its own link (origin practice)
 *   B — another practice's document released to this link by the patient
 *
 * Anything else — another link's grant, a revoked or expired grant, a foreign
 * patient — matches neither branch and is excluded in the database, not
 * afterwards in JavaScript.
 *
 * @param {{ link: { id: string, patientUserId: string }, practiceProfileId: string, now?: Date }} input
 */
export function practiceDocumentAccessWhere(input) {
  const link = input?.link;
  const practiceProfileId = String(input?.practiceProfileId || "").trim();
  if (!link?.id || !link?.patientUserId || !practiceProfileId) {
    throw err("grant_filter_requires_link");
  }

  return {
    OR: [
      // A — origin practice: its own document, on its own link.
      { practicePatientLinkId: link.id, practiceProfileId },
      // B — target practice: released by the patient, still effective.
      {
        shareGrants: {
          some: effectiveGrantWhere({
            targetPracticePatientLinkId: link.id,
            targetPracticeProfileId: practiceProfileId,
            patientUserId: link.patientUserId,
            now: input.now,
          }),
        },
      },
    ],
  };
}

/**
 * Which of the two access paths applies to a document already loaded through
 * practiceDocumentAccessWhere. Read paths use this to keep write operations
 * origin-only.
 *
 * @param {{ practicePatientLinkId: string|null, practiceProfileId: string }} doc
 */
export function isOriginPractice(doc, link, practiceProfileId) {
  return doc.practicePatientLinkId === link.id && doc.practiceProfileId === practiceProfileId;
}

/**
 * Records that a TARGET practice touched a document it only reaches through a
 * patient's grant. The origin practice's own access is already covered by the
 * existing document audit and is not duplicated here.
 *
 * Metadata is ids and status only. The document title is deliberately absent:
 * a title like "MRT Kopf" is medical information, and an audit log is a
 * different retention class from the document itself.
 *
 * @param {{ actorUserId?: string|null, actorRole?: string, req?: any,
 *           action: "shared_document_viewed"|"shared_document_downloaded",
 *           documentIds: string[], link: { id: string, patientUserId: string },
 *           practiceProfileId: string }} input
 */
export function auditSharedDocumentAccess(input) {
  const documentIds = (input?.documentIds ?? []).filter(Boolean);
  if (documentIds.length === 0) return;

  writeAuditLog({
    req: input.req,
    userId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? "practice",
    action: input.action,
    entityType: "document_share_grant",
    entityId: documentIds[0],
    practiceProfileId: input.practiceProfileId,
    practicePatientLinkId: input.link.id,
    metadata: {
      accessVia: "patient_share_grant",
      documentIds: documentIds.slice(0, 20),
      documentCount: documentIds.length,
      targetPracticeProfileId: input.practiceProfileId,
    },
  });
}

/* ============================================================ patient side */

/**
 * The patient releases one document to one other connected practice.
 *
 * Everything except the target link is derived server-side. The transaction is
 * serializable and locks the target link, so a grant cannot be created against
 * a revocation that is committing concurrently; the partial unique index is the
 * final backstop if two identical requests still race.
 *
 * @param {{ patientUserId: string, documentId: string, targetPracticePatientLinkId: string, req?: import('express').Request }} input
 */
export async function createDocumentShareGrant(input) {
  const patientUserId = String(input?.patientUserId || "").trim();
  const documentId = String(input?.documentId || "").trim();
  const targetLinkId = String(input?.targetPracticePatientLinkId || "").trim();
  if (!patientUserId || !documentId || !targetLinkId) throw err("validation_required");

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. The document, anchored on the patient. A document belonging to
      //    someone else is reported as not found — never as forbidden, which
      //    would confirm that it exists.
      const doc = await tx.practiceDocument.findFirst({
        where: { id: documentId, patientUserId },
        select: {
          id: true,
          practiceProfileId: true,
          practicePatientLinkId: true,
          patientUserId: true,
          status: true,
        },
      });
      if (!doc) throw err("document_not_found");
      if (doc.status === "deleted") throw err("document_not_found");
      // A document with no care relationship (the Meda PDF-QR flow stores
      // practice-owned PDFs without a link) has no source link to record.
      if (!doc.practicePatientLinkId) throw err("document_not_found");

      // 2. The target link, anchored on the same patient. Same reasoning: a
      //    link belonging to someone else does not exist as far as this
      //    caller is concerned.
      const targetLink = await tx.practicePatientLink.findFirst({
        where: { id: targetLinkId, patientUserId },
        select: { id: true, practiceProfileId: true, patientUserId: true, status: true },
      });
      if (!targetLink) throw err("link_not_found");
      if (!LINK_USABLE.has(targetLink.status)) throw err("link_not_active");

      // 3. Sharing back to the practice the document came from would create a
      //    second, weaker path to its own data.
      if (targetLink.practiceProfileId === doc.practiceProfileId) {
        throw err("document_already_available_to_practice");
      }

      // 4. Idempotent: an identical active grant is returned unchanged rather
      //    than duplicated or refreshed. Re-granting must not quietly extend
      //    an existing release.
      const existing = await tx.practiceDocumentShareGrant.findFirst({
        where: {
          documentId: doc.id,
          targetPracticePatientLinkId: targetLink.id,
          status: GRANT_STATUS.ACTIVE,
        },
      });
      if (existing && isGrantEffective(existing)) {
        return { grant: existing, created: false };
      }

      const grant = await tx.practiceDocumentShareGrant.create({
        data: {
          documentId: doc.id,
          patientUserId,
          sourcePracticeProfileId: doc.practiceProfileId,
          sourcePracticePatientLinkId: doc.practicePatientLinkId,
          targetPracticeProfileId: targetLink.practiceProfileId,
          targetPracticePatientLinkId: targetLink.id,
          status: GRANT_STATUS.ACTIVE,
          // Never taken from the body — the authenticated patient, always.
          grantedByUserId: patientUserId,
          grantedAt: new Date(),
        },
      });
      // MANDATORY audit, inside the same transaction as the grant.
      //
      // A share grant is the ONLY reason a document may become visible in a
      // second practice context, so a grant that exists without an audit row
      // would be an unexplained widening of access. Postgres decides: if this
      // insert fails, the grant is rolled back with it.
      //
      // Identifiers and status only — never a title, a file name or content.
      await writeRequiredAuditLog(
        {
          req: input.req,
          userId: patientUserId,
          actorRole: "patient",
          action: "document_share_grant_created",
          entityType: "document_share_grant",
          entityId: grant.id,
          practiceProfileId: grant.targetPracticeProfileId,
          practicePatientLinkId: grant.targetPracticePatientLinkId,
          metadata: {
            grantId: grant.id,
            documentId: grant.documentId,
            sourcePracticeProfileId: grant.sourcePracticeProfileId,
            targetPracticeProfileId: grant.targetPracticeProfileId,
            status: grant.status,
          },
        },
        tx,
      );

      return { grant, created: true };
    },
    { isolationLevel: "Serializable" },
  ).catch(async (e) => {
    // The partial unique index fired: a concurrent identical request won.
    // Return that grant instead of failing — the patient's intent is satisfied.
    if (e?.code === "P2002") {
      const existing = await prisma.practiceDocumentShareGrant.findFirst({
        where: {
          documentId,
          targetPracticePatientLinkId: targetLinkId,
          status: GRANT_STATUS.ACTIVE,
        },
      });
      if (existing) return { grant: existing, created: false };
    }
    throw e;
  });

  return result;
}

/**
 * The patient withdraws a release. Immediately effective for future practice
 * access, and every secure download token the target practice holds for this
 * document is invalidated in the same transaction — a token must not outlive
 * the permission it was issued under.
 *
 * @param {{ patientUserId: string, grantId: string, req?: import('express').Request }} input
 */
export async function revokeDocumentShareGrant(input) {
  const patientUserId = String(input?.patientUserId || "").trim();
  const grantId = String(input?.grantId || "").trim();
  if (!patientUserId || !grantId) throw err("validation_required");

  const grant = await prisma.practiceDocumentShareGrant.findFirst({
    where: { id: grantId, patientUserId },
  });
  if (!grant) throw err("grant_not_found");

  // Already revoked or expired: report the state, change nothing. A second
  // revoke must not move revokedAt or write a second audit entry.
  if (grant.status !== GRANT_STATUS.ACTIVE) {
    return { grant, revoked: false };
  }

  // Interactive rather than the array form, so the mandatory audit can join the
  // same transaction: revoking a grant withdraws access from a second practice,
  // and that must not be able to happen unrecorded.
  const { updated, fresh } = await prisma.$transaction((tx) =>
    revokeGrantWithin(tx, grant, { actorUserId: patientUserId, actorRole: "patient", req: input.req }),
  );

  return { grant: fresh ?? grant, revoked: updated.count > 0 };
}

/**
 * The revocation itself, inside a caller-supplied transaction.
 *
 * Extracted so that flows which already own a transaction — account deletion in
 * particular — can end a grant through THIS logic instead of reaching for a
 * `deleteMany`. Prisma has no nested interactive transactions, so a shared body
 * is the only way for both callers to keep one behaviour: the same conditional
 * update, the same token invalidation, and the same mandatory audit entry in
 * the same transaction as the change it describes.
 *
 * @param {object} tx an interactive transaction client
 * @param {{ id: string, documentId: string, patientUserId: string,
 *           sourcePracticeProfileId: string, targetPracticeProfileId: string,
 *           targetPracticePatientLinkId: string }} grant already loaded
 * @param {{ actorUserId: string, actorRole?: string, req?: object,
 *           reason?: string }} ctx who is ending it, and why
 */
export async function revokeGrantWithin(tx, grant, ctx) {
  const now = new Date();

  // Conditional on status: if a concurrent request revoked it first, this
  // updates nothing rather than overwriting the earlier revocation.
  const updated = await tx.practiceDocumentShareGrant.updateMany({
    where: { id: grant.id, patientUserId: grant.patientUserId, status: GRANT_STATUS.ACTIVE },
    data: { status: GRANT_STATUS.REVOKED, revokedAt: now },
  });

  // A bearer token outliving the permission it was issued under is the failure
  // mode that matters, so it dies with the grant.
  await tx.secureDocumentAccessToken.updateMany({
    where: {
      documentId: grant.documentId,
      practiceProfileId: grant.targetPracticeProfileId,
      practicePatientLinkId: grant.targetPracticePatientLinkId,
      audience: "practice",
      revokedAt: null,
    },
    data: { revokedAt: now },
  });

  if (updated.count > 0) {
    await writeRequiredAuditLog(
      {
        req: ctx.req,
        userId: ctx.actorUserId,
        actorRole: ctx.actorRole || "patient",
        action: "document_share_grant_revoked",
        entityType: "document_share_grant",
        entityId: grant.id,
        practiceProfileId: grant.targetPracticeProfileId,
        practicePatientLinkId: grant.targetPracticePatientLinkId,
        metadata: {
          grantId: grant.id,
          documentId: grant.documentId,
          sourcePracticeProfileId: grant.sourcePracticeProfileId,
          targetPracticeProfileId: grant.targetPracticeProfileId,
          status: GRANT_STATUS.REVOKED,
          ...(ctx.reason ? { reason: ctx.reason } : {}),
        },
      },
      tx,
    );
  }

  const fresh = await tx.practiceDocumentShareGrant.findUnique({ where: { id: grant.id } });
  return { updated, fresh };
}

/**
 * The patient's own overview of what they have released.
 *
 * @param {string} patientUserId
 */
export async function listDocumentShareGrantsForPatient(patientUserId) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw err("validation_required");

  const rows = await prisma.practiceDocumentShareGrant.findMany({
    where: { patientUserId: uid },
    orderBy: { grantedAt: "desc" },
    include: {
      document: { select: { id: true, title: true, type: true } },
      sourcePracticeProfile: { select: { id: true, practiceName: true } },
      targetPracticeProfile: { select: { id: true, practiceName: true } },
    },
  });
  return rows.map(grantToPatientJson);
}

/**
 * Patient-facing shape of a grant.
 *
 * The document title is included because the patient wrote or received it and
 * needs to recognise what they released — this is their own data. Everything
 * that is not theirs is left out: no patientUserId (they know who they are),
 * no practice staff user ids, no storage keys, no download tokens.
 *
 * @param {any} row
 */
export function grantToPatientJson(row) {
  return {
    id: row.id,
    documentId: row.documentId,
    documentTitle: row.document?.title ?? null,
    documentType: row.document?.type ?? null,
    sourcePractice: row.sourcePracticeProfile
      ? { id: row.sourcePracticeProfile.id, practiceName: row.sourcePracticeProfile.practiceName }
      : { id: row.sourcePracticeProfileId, practiceName: null },
    targetPractice: row.targetPracticeProfile
      ? { id: row.targetPracticeProfile.id, practiceName: row.targetPracticeProfile.practiceName }
      : { id: row.targetPracticeProfileId, practiceName: null },
    status: row.status,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt ?? null,
    expiresAt: row.expiresAt ?? null,
  };
}

/**
 * Maps service errors to HTTP status codes.
 *
 * A foreign document and a missing document both produce 404 with the same
 * body: telling the two apart would confirm that another patient's document
 * exists.
 */
export function grantErrorResponse(e) {
  const msg = e?.message || "request_failed";
  if (msg === "unsupported_field") return { status: 400, error: "unsupported_field" };
  if (msg === "validation_required") return { status: 400, error: "validation_required" };
  if (msg === "document_not_found") return { status: 404, error: "document_not_found" };
  if (msg === "link_not_found") return { status: 404, error: "link_not_found" };
  if (msg === "grant_not_found") return { status: 404, error: "grant_not_found" };
  if (msg === "link_not_active") return { status: 409, error: "link_not_active" };
  if (msg === "document_already_available_to_practice") {
    return { status: 409, error: "document_already_available_to_practice" };
  }
  return { status: 500, error: "request_failed" };
}
