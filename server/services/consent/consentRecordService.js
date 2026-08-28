import { prisma } from "../../lib/prisma.js";
import { writeAuditLog, writeRequiredAuditLog } from "../auditLogService.js";
import { logSecurityEvent } from "../security/securityEventService.js";
import {
  CARE_CONSENT_VERSION,
  normalizeConsentScopes,
} from "../careRelationship/consentScopes.js";
import {
  CONSENT_TYPE_TO_LEGACY_SCOPE,
  isValidConsentType,
  LEGACY_SCOPE_TO_CONSENT_TYPE,
} from "./consentTypes.js";
import { PRACTICE_BRANDING_SELECT, practiceBrandingJson } from "../../utils/practiceBranding.js";

const LINK_ACTIVE = new Set(["invited", "active"]);

/**
 * @param {import("@prisma/client").ConsentRecord} row
 */
/**
 * @param {import("@prisma/client").ConsentRecord} row
 * @param {string | import('../../utils/practiceBranding.js').ReturnType<typeof practiceBrandingJson> | null} practiceInfo
 */
export function consentRecordToJson(row, practiceInfo = null) {
  const practice =
    practiceInfo && typeof practiceInfo === "object" && practiceInfo.id
      ? practiceInfo
      : null;
  const practiceName =
    practice?.displayName ||
    practice?.practiceName ||
    (typeof practiceInfo === "string" ? practiceInfo : null);

  return {
    id: row.id,
    patientUserId: row.patientUserId,
    practiceProfileId: row.practiceProfileId,
    practicePatientLinkId: row.practicePatientLinkId,
    consentType: row.consentType,
    status: row.status,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    version: row.version,
    practiceName,
    practice,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * @param {string} linkId
 */
export async function expireStaleConsentsForLink(linkId) {
  const lid = String(linkId || "").trim();
  if (!lid) return;
  const now = new Date();
  const stale = await prisma.consentRecord.findMany({
    where: {
      practicePatientLinkId: lid,
      status: "granted",
      expiresAt: { lte: now },
    },
    select: { id: true, consentType: true, patientUserId: true, practiceProfileId: true },
  });
  if (!stale.length) return;

  await prisma.consentRecord.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: "expired", updatedAt: now },
  });

  for (const row of stale) {
    writeAuditLog({
      userId: row.patientUserId,
      actorRole: "system",
      action: "consent_record_expired",
      entityType: "consent_record",
      entityId: row.id,
      practiceProfileId: row.practiceProfileId,
      patientUserId: row.patientUserId,
      practicePatientLinkId: lid,
      metadata: { consentType: row.consentType },
    });
  }
  await syncLinkScopesFromRecords(lid);
}

/**
 * @param {string} linkId
 */
export async function syncLinkScopesFromRecords(linkId) {
  const link = await prisma.practicePatientLink.findUnique({ where: { id: linkId } });
  if (!link) return;

  const active = await prisma.consentRecord.findMany({
    where: { practicePatientLinkId: linkId, status: "granted" },
    select: { consentType: true },
  });

  const scopes = [];
  for (const row of active) {
    const scope = CONSENT_TYPE_TO_LEGACY_SCOPE[row.consentType];
    if (scope && !scopes.includes(scope)) scopes.push(scope);
  }

  const data = {
    consentScopes: scopes,
    updatedAt: new Date(),
  };

  if (scopes.includes("profile")) {
    if (!link.profileAccessGrantedAt) {
      data.profileAccessGrantedAt = new Date();
      data.profileAccessRevokedAt = null;
    }
  } else if (link.profileAccessGrantedAt && !link.profileAccessRevokedAt) {
    data.profileAccessRevokedAt = new Date();
  }

  if (scopes.length > 0 && !link.consentAcceptedAt) {
    data.consentAcceptedAt = new Date();
    data.consentVersion = link.consentVersion || CARE_CONSENT_VERSION;
  }

  await prisma.practicePatientLink.update({ where: { id: linkId }, data });
}

/**
 * @param {import("@prisma/client").PracticePatientLink} link
 * @param {string} consentType
 */
export async function linkHasConsentType(link, consentType) {
  if (!link || !LINK_ACTIVE.has(link.status)) return false;
  await expireStaleConsentsForLink(link.id);

  // ConsentRecord is the ONLY authority. It used to be one of two, and the
  // second one failed open.
  //
  // The removed fallback read `link.consentScopes`, and treated an EMPTY array
  // as "the original three scopes" — profile, medication, messages. That is
  // exactly the state a full withdrawal produces: revokeConsentRecord() ->
  // syncLinkScopesFromRecords() empties consentScopes, while consentAcceptedAt
  // keeps its historical value because nothing ever clears it and the link
  // stays `active`. So withdrawing every consent RESTORED the three original
  // ones. The fallback existed for links predating the ConsentRecord model,
  // whose consent lived only in that denormalised array; it could not tell
  // "never migrated" from "deliberately withdrawn", and answered both with yes.
  //
  // consentScopes is no longer a source in any case — syncLinkScopesFromRecords
  // derives it FROM these records, so consulting it was asking the mirror.
  //
  // The NEWEST record for the type decides, rather than "any granted row
  // anywhere": a withdrawal must not be outvoted by a stale grant that an
  // interrupted supersede left behind. Ordering by id breaks a createdAt tie
  // deterministically; the write path cannot produce one.
  const latest = await prisma.consentRecord.findFirst({
    where: {
      practicePatientLinkId: link.id,
      consentType,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return latest?.status === "granted";
}

/**
 * @param {import("@prisma/client").PracticePatientLink} link
 * @param {string} consentType
 * @param {{ req?: import('express').Request, actorUserId?: string, actorRole?: string }} ctx
 */
export async function assertConsentForLink(link, consentType, ctx = {}) {
  const ok = await linkHasConsentType(link, consentType);
  if (!ok) {
    logSecurityEvent({
      req: ctx.req,
      userId: ctx.actorUserId,
      actorRole: ctx.actorRole || "practice",
      eventType: "consent_access_denied",
      practiceProfileId: link.practiceProfileId,
      patientUserId: link.patientUserId,
      practicePatientLinkId: link.id,
      entityId: link.id,
      metadata: { consentType },
    });
    const err = new Error("consent_required");
    err.consentType = consentType;
    throw err;
  }
  return link;
}

/**
 * Backfill ConsentRecord rows from legacy consentScopes on link.
 * @param {import("@prisma/client").PracticePatientLink} link
 */
export async function backfillConsentRecordsFromLink(link) {
  if (!link.consentAcceptedAt) return;
  const scopes = Array.isArray(link.consentScopes) ? link.consentScopes : [];

  // An empty scopes array is not a licence. The old code read it as "the three
  // original scopes" and wrote GRANTED records for them, which turned a
  // withdrawal into a grant. There is nothing here to migrate: no recorded
  // scope means no consent to carry forward.
  if (scopes.length === 0) return;

  const types = scopes.map((s) => LEGACY_SCOPE_TO_CONSENT_TYPE[s]).filter(Boolean);

  for (const consentType of types) {
    const existing = await prisma.consentRecord.findFirst({
      where: { practicePatientLinkId: link.id, consentType },
      select: { id: true },
    });

    // ANY record — granted, revoked or expired — means this consent type
    // already has a history, and history is not this function's business. The
    // previous guard skipped only `granted` rows, so a revoked one was treated
    // as "not yet migrated" and overwritten with a fresh grant.
    //
    // The distinction is exact, not a guess: a record exists if and only if the
    // type has been through the ConsentRecord lifecycle. Nothing is inferred
    // from consentAcceptedAt or from the scopes array.
    if (existing) continue;

    await prisma.consentRecord.create({
      data: {
        patientUserId: link.patientUserId,
        practiceProfileId: link.practiceProfileId,
        practicePatientLinkId: link.id,
        consentType,
        status: "granted",
        grantedAt: link.consentAcceptedAt,
        grantedByUserId: link.patientUserId,
        version: link.consentVersion || CARE_CONSENT_VERSION,
      },
    });
  }
}

/**
 * @param {string} patientUserId
 */
export async function listPatientConsents(patientUserId) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const links = await prisma.practicePatientLink.findMany({
    where: { patientUserId: uid },
    include: { practiceProfile: { select: PRACTICE_BRANDING_SELECT } },
  });

  // No backfill here. Reading one's own consent overview must not WRITE a
  // consent — the grant it used to create was attributed to the patient
  // (grantedByUserId = patientUserId) although the patient had done nothing but
  // open a page. Expiry stays: it only ever withdraws, never grants.
  for (const link of links) {
    await expireStaleConsentsForLink(link.id);
  }

  const rows = await prisma.consentRecord.findMany({
    where: { patientUserId: uid },
    orderBy: [{ practiceProfileId: "asc" }, { consentType: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const brandingByPractice = Object.fromEntries(
    links
      .filter((l) => l.practiceProfile)
      .map((l) => [l.practiceProfileId, practiceBrandingJson(l.practiceProfile)]),
  );

  return rows.map((r) =>
    consentRecordToJson(r, brandingByPractice[r.practiceProfileId] || null),
  );
}

/**
 * @param {{ patientUserId: string, practicePatientLinkId: string, consentType: string, expiresAt?: string | Date | null, req?: import('express').Request }} input
 */
export async function grantConsentRecord(input) {
  const uid = String(input.patientUserId || "").trim();
  const linkId = String(input.practicePatientLinkId || "").trim();
  const consentType = String(input.consentType || "").trim();

  if (!uid || !linkId || !isValidConsentType(consentType)) {
    throw new Error("validation_required");
  }

  const link = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, patientUserId: uid },
  });
  if (!link) throw new Error("link_not_found");
  if (!LINK_ACTIVE.has(link.status)) throw new Error("link_not_active");

  let expiresAt = null;
  if (input.expiresAt) {
    const d = new Date(input.expiresAt);
    if (Number.isNaN(d.getTime())) throw new Error("validation_invalid_date");
    expiresAt = d;
  }

  const now = new Date();

  // Granting consent supersedes the previous record, may activate the care
  // relationship, and MUST leave an audit row. All four steps now share one
  // transaction: previously they ran separately, so a failure could revoke the
  // old consent without creating the new one — and the audit could fail while
  // the grant stood, which is the gap this phase exists to close.
  //
  // syncLinkScopesFromRecords() stays outside: it is derived from the records
  // and idempotent, so it has nothing to do if the transaction rolled back.
  const row = await prisma.$transaction(async (tx) => {
    await tx.consentRecord.updateMany({
      where: {
        practicePatientLinkId: linkId,
        consentType,
        status: "granted",
      },
      data: { status: "revoked", revokedAt: now, revokedByUserId: uid },
    });

    const created = await tx.consentRecord.create({
      data: {
        patientUserId: uid,
        practiceProfileId: link.practiceProfileId,
        practicePatientLinkId: linkId,
        consentType,
        status: "granted",
        grantedAt: now,
        grantedByUserId: uid,
        expiresAt,
        version: CARE_CONSENT_VERSION,
      },
    });

    if (link.status === "invited") {
      await tx.practicePatientLink.update({
        where: { id: linkId },
        data: { status: "active" },
      });
    }

    // Consent type and whether it expires — never the medical purpose behind it.
    await writeRequiredAuditLog(
      {
        req: input.req,
        userId: uid,
        actorRole: "patient",
        action: "consent_record_granted",
        entityType: "consent_record",
        entityId: created.id,
        practiceProfileId: link.practiceProfileId,
        patientUserId: uid,
        practicePatientLinkId: linkId,
        metadata: {
          consentType,
          hasExpiry: Boolean(expiresAt),
        },
      },
      tx,
    );

    return created;
  });

  await syncLinkScopesFromRecords(linkId);

  const practice = await prisma.practiceProfile.findUnique({
    where: { id: link.practiceProfileId },
    select: { practiceName: true },
  });

  return consentRecordToJson(row, practice?.practiceName || null);
}

/**
 * @param {string} consentId
 * @param {string} patientUserId
 * @param {{ req?: import('express').Request }} ctx
 */
export async function revokeConsentRecord(consentId, patientUserId, ctx = {}) {
  const id = String(consentId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const row = await prisma.consentRecord.findFirst({
    where: { id, patientUserId: uid },
  });
  if (!row) throw new Error("consent_not_found");
  if (row.status !== "granted") return consentRecordToJson(row);

  const now = new Date();

  // Withdrawing consent must never take effect unrecorded, so the state change
  // and its audit row commit together.
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.consentRecord.update({
      where: { id },
      data: {
        status: "revoked",
        revokedAt: now,
        revokedByUserId: uid,
      },
    });

    await writeRequiredAuditLog(
      {
        req: ctx.req,
        userId: uid,
        actorRole: "patient",
        action: "consent_record_revoked",
        entityType: "consent_record",
        entityId: id,
        practiceProfileId: row.practiceProfileId,
        patientUserId: uid,
        practicePatientLinkId: row.practicePatientLinkId,
        metadata: { consentType: row.consentType },
      },
      tx,
    );

    return changed;
  });

  // Derived follow-ups run after the revocation is durable. Both are idempotent
  // and both only ever narrow access, so running them late can widen nothing.
  if (row.practicePatientLinkId) {
    await syncLinkScopesFromRecords(row.practicePatientLinkId);
    if (row.consentType === "optional_secure_links" || row.consentType === "document_sharing") {
      await revokeSecureLinksForLink(row.practicePatientLinkId, row.practiceProfileId);
    }
  }

  return consentRecordToJson(updated);
}

/**
 * @param {string} linkId
 * @param {string | null} practiceProfileId
 */
async function revokeSecureLinksForLink(linkId, practiceProfileId) {
  if (!practiceProfileId) return;
  await prisma.secureDocumentAccessToken.updateMany({
    where: {
      practicePatientLinkId: linkId,
      practiceProfileId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function listPracticeLinkConsents(linkId, practiceProfileId) {
  const lid = String(linkId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  if (!lid || !pid) throw new Error("validation_required");

  const link = await prisma.practicePatientLink.findFirst({
    where: { id: lid, practiceProfileId: pid },
  });
  if (!link) throw new Error("link_not_found");

  // No backfill here either, and least of all here: this is the PRACTICE
  // looking at the relationship, so the write it used to trigger recorded a
  // consent in the patient's name on the practice's request.
  await expireStaleConsentsForLink(lid);

  const rows = await prisma.consentRecord.findMany({
    where: { practicePatientLinkId: lid },
    orderBy: { consentType: "asc" },
  });

  return rows.map((r) =>
    consentRecordToJson(r, null).status === "granted"
      ? { consentType: r.consentType, status: r.status, grantedAt: r.grantedAt, expiresAt: r.expiresAt }
      : { consentType: r.consentType, status: r.status },
  );
}
