import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
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

const prisma = new PrismaClient();
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
    await writeAuditLog({
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

  const active = await prisma.consentRecord.findFirst({
    where: {
      practicePatientLinkId: link.id,
      consentType,
      status: "granted",
    },
  });
  if (active) return true;

  const legacyScope = CONSENT_TYPE_TO_LEGACY_SCOPE[consentType];
  if (!legacyScope) return false;

  const scopes = Array.isArray(link.consentScopes) ? link.consentScopes : [];
  if (!link.consentAcceptedAt) return false;
  if (scopes.length === 0) {
    return ["profile", "medication", "messages"].includes(legacyScope);
  }
  return scopes.includes(legacyScope);
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
  const types =
    scopes.length > 0
      ? scopes.map((s) => LEGACY_SCOPE_TO_CONSENT_TYPE[s]).filter(Boolean)
      : ["profile_access", "medication_plan_access", "secure_messaging"];

  for (const consentType of types) {
    const existing = await prisma.consentRecord.findFirst({
      where: { practicePatientLinkId: link.id, consentType },
      orderBy: { createdAt: "desc" },
    });
    if (existing && existing.status === "granted") continue;

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

  for (const link of links) {
    await backfillConsentRecordsFromLink(link);
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

  await prisma.consentRecord.updateMany({
    where: {
      practicePatientLinkId: linkId,
      consentType,
      status: "granted",
    },
    data: { status: "revoked", revokedAt: now, revokedByUserId: uid },
  });

  const row = await prisma.consentRecord.create({
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
    await prisma.practicePatientLink.update({
      where: { id: linkId },
      data: { status: "active" },
    });
  }

  await syncLinkScopesFromRecords(linkId);

  await writeAuditLog({
    req: input.req,
    userId: uid,
    actorRole: "patient",
    action: "consent_record_granted",
    entityType: "consent_record",
    entityId: row.id,
    practiceProfileId: link.practiceProfileId,
    patientUserId: uid,
    practicePatientLinkId: linkId,
    metadata: {
      consentType,
      hasExpiry: Boolean(expiresAt),
    },
  });

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
  const updated = await prisma.consentRecord.update({
    where: { id },
    data: {
      status: "revoked",
      revokedAt: now,
      revokedByUserId: uid,
    },
  });

  if (row.practicePatientLinkId) {
    await syncLinkScopesFromRecords(row.practicePatientLinkId);
    if (row.consentType === "optional_secure_links" || row.consentType === "document_sharing") {
      await revokeSecureLinksForLink(row.practicePatientLinkId, row.practiceProfileId);
    }
  }

  await writeAuditLog({
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
  });

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

  await backfillConsentRecordsFromLink(link);
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
