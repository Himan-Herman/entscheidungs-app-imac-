import { prisma } from "../../lib/prisma.js";
import { writeRequiredAuditLog } from "../auditLogService.js";
import { PRACTICE_BRANDING_SELECT, practiceBrandingJson } from "../../utils/practiceBranding.js";
import {
  CARE_CONSENT_VERSION,
  isAllowedConsentVersion,
  linkHasConsentScope,
  normalizeConsentScopes,
} from "./consentScopes.js";
import { assignmentExtras } from "../../utils/practiceOrganizationJson.js";


export const LINK_STATUSES = new Set([
  "invited",
  "active",
  "revoked",
  "archived",
  "declined",
]);

const ACTIVE_LIKE = new Set(["invited", "active"]);

/**
 * A link the patient has never accepted must not disclose identity to the
 * practice. Otherwise a practice could turn a known user id into a name and an
 * e-mail address by creating a pending link (account enumeration). Once the
 * patient has accepted (or the link is active), the practice is in a care
 * relationship and identity is part of it. Revoked/archived links that were
 * accepted at some point keep their identity so existing records stay readable.
 *
 * @param {{ status: string, consentAcceptedAt?: Date | null }} row
 */
function mayDiscloseIdentity(row) {
  return row.status === "active" || Boolean(row.consentAcceptedAt);
}

/**
 * @param {import("@prisma/client").PracticePatientLink & { patientUser?: object, patientProfile?: object | null }} row
 */
export function linkToJson(row) {
  const user = mayDiscloseIdentity(row) ? row.patientUser : null;
  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    // The global patientUserId is deliberately NOT exposed. A practice must
    // reference a patient only through this practice-scoped link id, so a
    // global account identifier can never be correlated across tenants or
    // replayed into another practice's request. It stays available internally.
    patientProfileId: row.patientProfileId,
    status: row.status,
    linkedAt: row.linkedAt,
    revokedAt: row.revokedAt,
    consentVersion: row.consentVersion,
    consentAcceptedAt: row.consentAcceptedAt,
    consentScopes: Array.isArray(row.consentScopes) ? row.consentScopes : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    assignment: assignmentExtras(row),
    patient: user
      ? {
          // No `id` here either: it is the same global account identifier and
          // would defeat the point of withholding patientUserId above.
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        }
      : null,
    patientProfile: row.patientProfile
      ? {
          id: row.patientProfile.id,
          displayName: row.patientProfile.displayName,
          relationLabel: row.patientProfile.relationLabel,
        }
      : null,
  };
}

const includePatient = {
  patientUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  patientProfile: {
    select: { id: true, displayName: true, relationLabel: true },
  },
};

const includePatientPortal = {
  practiceProfile: {
    // Uses the shared branding select so the practice a patient sees here is
    // described exactly as it is everywhere else — same name resolution, same
    // logo, same specialty and city.
    select: PRACTICE_BRANDING_SELECT,
  },
  patientProfile: {
    select: { id: true, displayName: true, relationLabel: true },
  },
};

/**
 * Patient-facing link payload (no other patients' data).
 * @param {import("@prisma/client").PracticePatientLink & { practiceProfile?: object, patientProfile?: object | null }} row
 */
export function linkToPatientJson(row) {
  const practice = row.practiceProfile;
  return {
    id: row.id,
    status: row.status,
    patientProfileId: row.patientProfileId,
    linkedAt: row.linkedAt,
    revokedAt: row.revokedAt,
    consentVersion: row.consentVersion,
    consentAcceptedAt: row.consentAcceptedAt,
    consentScopes: Array.isArray(row.consentScopes) ? row.consentScopes : null,
    profileAccessGranted: linkHasConsentScope(row, "profile"),
    profileAccessGrantedAt: row.profileAccessGrantedAt,
    profileAccessRevokedAt: row.profileAccessRevokedAt,
    practice: practice ? practiceBrandingJson(practice) : null,
    patientProfile: row.patientProfile
      ? {
          id: row.patientProfile.id,
          displayName: row.patientProfile.displayName,
          relationLabel: row.patientProfile.relationLabel,
        }
      : null,
  };
}

/**
 * @param {string} practiceProfileId
 * @param {string} patientUserId
 * @param {string | null | undefined} patientProfileId
 */
async function findActiveDuplicate(practiceProfileId, patientUserId, patientProfileId) {
  const profileFilter =
    patientProfileId === null || patientProfileId === undefined || patientProfileId === ""
      ? null
      : String(patientProfileId);

  return prisma.practicePatientLink.findFirst({
    where: {
      practiceProfileId,
      patientUserId,
      patientProfileId: profileFilter,
      status: { in: [...ACTIVE_LIKE] },
    },
  });
}

/**
 * @param {{ practiceProfileId: string, patientUserId: string, patientProfileId?: string | null, status?: string }} input
 */
export async function createPracticePatientLink(input) {
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  const patientUserId = String(input.patientUserId || "").trim();
  if (!practiceProfileId || !patientUserId) {
    throw new Error("validation_required");
  }

  // A practice must never be able to activate a link on its own. New links are
  // always PENDING; only the patient may promote them to "active", and only via
  // acceptPracticePatientLinkConsent (connect code redemption or accepting an
  // email invitation). No caller needs "active" here — the connect-code flow
  // creates "invited" and activates through the consent path.
  let status = "invited";
  if (input.status === "active") {
    throw new Error("validation_link_activation_requires_patient_consent");
  }
  if (input.status === "invited") {
    status = input.status;
  } else if (input.status != null && String(input.status).trim()) {
    throw new Error("validation_invalid_status");
  }

  let patientProfileId = null;
  if (input.patientProfileId != null && String(input.patientProfileId).trim()) {
    patientProfileId = String(input.patientProfileId).trim();
    const profile = await prisma.patientProfile.findFirst({
      where: { id: patientProfileId, userId: patientUserId, isArchived: false },
    });
    if (!profile) throw new Error("patient_profile_not_found");
  }

  const patientUser = await prisma.user.findUnique({ where: { id: patientUserId } });
  if (!patientUser) throw new Error("patient_user_not_found");

  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceProfileId },
  });
  if (!practice) throw new Error("practice_not_found");

  const duplicate = await findActiveDuplicate(
    practiceProfileId,
    patientUserId,
    patientProfileId,
  );
  if (duplicate) throw new Error("link_already_exists");

  const now = new Date();
  const row = await prisma.practicePatientLink.create({
    data: {
      practiceProfileId,
      patientUserId,
      patientProfileId,
      status,
      linkedAt: now,
    },
    include: includePatient,
  });

  return linkToJson(row);
}

/**
 * @param {string} practiceProfileId
 * @param {{ status?: string, limit?: number, offset?: number }} [opts]
 */
export async function listPracticePatientLinks(practiceProfileId, opts = {}) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("practiceId_required");

  const statusFilter =
    opts.status && LINK_STATUSES.has(opts.status) ? opts.status : undefined;

  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);

  const [rows, total] = await Promise.all([
    prisma.practicePatientLink.findMany({
      where: {
        practiceProfileId: pid,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: includePatient,
      orderBy: [{ linkedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.practicePatientLink.count({
      where: {
        practiceProfileId: pid,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
    }),
  ]);

  return {
    links: rows.map(linkToJson),
    total,
    limit,
    offset,
  };
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function getPracticePatientLink(linkId, practiceProfileId) {
  const id = String(linkId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  if (!id || !pid) throw new Error("validation_required");

  const row = await prisma.practicePatientLink.findFirst({
    where: { id, practiceProfileId: pid },
    include: includePatient,
  });
  if (!row) throw new Error("link_not_found");
  return linkToJson(row);
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 * @param {string} nextStatus
 */
export async function updatePracticePatientLinkStatus(
  linkId,
  practiceProfileId,
  nextStatus,
) {
  const id = String(linkId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  const status = String(nextStatus || "").trim();

  if (!id || !pid) throw new Error("validation_required");
  if (!LINK_STATUSES.has(status)) throw new Error("validation_invalid_status");

  const existing = await prisma.practicePatientLink.findFirst({
    where: { id, practiceProfileId: pid },
  });
  if (!existing) throw new Error("link_not_found");

  const now = new Date();
  const data = { status, updatedAt: now };

  if (status === "revoked" || status === "archived") {
    data.revokedAt = existing.revokedAt || now;
  } else if (status === "active" || status === "invited") {
    data.revokedAt = null;
    const duplicate = await findActiveDuplicate(
      pid,
      existing.patientUserId,
      existing.patientProfileId,
    );
    if (duplicate && duplicate.id !== id) {
      throw new Error("link_already_exists");
    }
  }

  const row = await prisma.practicePatientLink.update({
    where: { id },
    data,
    include: includePatient,
  });

  return linkToJson(row);
}

/** @alias createPracticePatientLink */
export const createLink = createPracticePatientLink;

/** @alias listPracticePatientLinks */
export const listLinksByPractice = listPracticePatientLinks;

/** @alias getPracticePatientLink */
export const getLinkById = getPracticePatientLink;

/** @alias updatePracticePatientLinkStatus */
export const updateLinkStatus = updatePracticePatientLinkStatus;

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function revokeLink(linkId, practiceProfileId) {
  return updatePracticePatientLinkStatus(linkId, practiceProfileId, "revoked");
}

/**
 * @param {string} linkId
 * @param {string} practiceProfileId
 */
export async function archiveLink(linkId, practiceProfileId) {
  return updatePracticePatientLinkStatus(linkId, practiceProfileId, "archived");
}

/**
 * For later phases: ensure a link exists when a Pre-Visit session is tied to a practice.
 * Not wired to routes in Step 1 — call only from future hooks behind a feature flag.
 *
 * @param {{ practiceProfileId: string, patientUserId: string, patientProfileId?: string | null }} input
 */
export async function findOrCreatePracticePatientLink(input) {
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  const patientUserId = String(input.patientUserId || "").trim();
  let patientProfileId = null;
  if (input.patientProfileId != null && String(input.patientProfileId).trim()) {
    patientProfileId = String(input.patientProfileId).trim();
  }

  const existing = await findActiveDuplicate(
    practiceProfileId,
    patientUserId,
    patientProfileId,
  );
  if (existing) {
    const row = await prisma.practicePatientLink.findUnique({
      where: { id: existing.id },
      include: includePatient,
    });
    return linkToJson(row);
  }

  // Pending by design: a link created by a practice-side hook must still be
  // accepted by the patient before any data flows.
  return createPracticePatientLink({
    practiceProfileId,
    patientUserId,
    patientProfileId,
    status: "invited",
  });
}

/**
 * Practice-initiated link request by patient email (Fall A). PRIVACY: never reveals to the
 * practice whether an account exists — the route always responds neutrally; this verdict is
 * for audit/logging only. Creates at most a PENDING ("invited") link the patient must accept;
 * no data flows before acceptance.
 * @param {{ practiceProfileId: string, email: string }} input
 * @returns {Promise<{ created: boolean, reason: "created"|"no_account"|"already_linked", link?: object, linkId?: string }>}
 */
export async function requestLinkByEmail(input) {
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  if (!practiceProfileId || !email) throw new Error("validation_required");

  const patientUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!patientUser) return { created: false, reason: "no_account" };

  const existing = await findActiveDuplicate(practiceProfileId, patientUser.id, null);
  if (existing) return { created: false, reason: "already_linked", linkId: existing.id };

  const link = await createPracticePatientLink({
    practiceProfileId,
    patientUserId: patientUser.id,
    status: "invited",
  });
  return { created: true, reason: "created", link };
}

/**
 * Patient declines a PENDING ("invited") practice link request (Fall A). Only invited links
 * can be declined; an active link is ended via archive (revoke) instead.
 * @param {string} linkId
 * @param {string} patientUserId
 */
export async function declinePracticePatientLink(linkId, patientUserId, ctx = {}) {
  const id = String(linkId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const existing = await prisma.practicePatientLink.findFirst({
    where: { id, patientUserId: uid },
  });
  if (!existing) throw new Error("link_not_found");
  if (existing.status !== "invited") throw new Error("link_not_invited");

  // The audit lives HERE, not in the route: only inside the service can it share
  // a transaction with the state change. A declined relationship that left no
  // record would be indistinguishable from one that was never offered.
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.practicePatientLink.update({
      where: { id },
      data: { status: "declined", updatedAt: new Date() },
      include: includePatientPortal,
    });

    await writeRequiredAuditLog(
      {
        req: ctx.req,
        userId: uid,
        actorRole: "patient",
        action: "practice_patient_link_declined",
        entityType: "PracticePatientLink",
        entityId: id,
        practiceProfileId: existing.practiceProfileId,
        patientUserId: uid,
        practicePatientLinkId: id,
        metadata: { previousStatus: existing.status, newStatus: "declined" },
      },
      tx,
    );

    return updated;
  });

  return linkToPatientJson(row);
}

/**
 * @param {string} patientUserId
 * @param {{ status?: string, limit?: number, offset?: number }} [opts]
 */
export async function listPatientCareLinks(patientUserId, opts = {}) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const statusFilter =
    opts.status && LINK_STATUSES.has(opts.status) ? opts.status : undefined;
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);

  const [rows, total] = await Promise.all([
    prisma.practicePatientLink.findMany({
      where: {
        patientUserId: uid,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: includePatientPortal,
      orderBy: [{ linkedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.practicePatientLink.count({
      where: {
        patientUserId: uid,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
    }),
  ]);

  return {
    links: rows.map(linkToPatientJson),
    total,
    limit,
    offset,
  };
}

/**
 * @param {string} linkId
 * @param {string} patientUserId
 */
export async function getPatientCareLink(linkId, patientUserId) {
  const id = String(linkId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const row = await prisma.practicePatientLink.findFirst({
    where: { id, patientUserId: uid },
    include: includePatientPortal,
  });
  if (!row) throw new Error("link_not_found");
  return linkToPatientJson(row);
}

/**
 * Patient accepts consent for a practice link. Does not enable clinical modules by itself.
 * @param {{ linkId: string, patientUserId: string, consentVersion?: string, scopes?: string[] }} input
 */
export async function acceptPracticePatientLinkConsent(input) {
  const linkId = String(input.linkId || "").trim();
  const patientUserId = String(input.patientUserId || "").trim();
  if (!linkId || !patientUserId) throw new Error("validation_required");

  const version = String(input.consentVersion || CARE_CONSENT_VERSION).trim();
  if (!isAllowedConsentVersion(version)) {
    throw new Error("validation_invalid_consent_version");
  }

  const scopes = normalizeConsentScopes(input.scopes);
  if (scopes.length === 0) throw new Error("validation_consent_scopes_required");

  const existing = await prisma.practicePatientLink.findFirst({
    where: { id: linkId, patientUserId },
  });
  if (!existing) throw new Error("link_not_found");
  if (existing.status === "revoked" || existing.status === "archived") {
    throw new Error("link_not_active");
  }

  const now = new Date();
  const data = {
    consentVersion: version,
    consentAcceptedAt: now,
    consentScopes: scopes,
    updatedAt: now,
  };
  if (existing.status === "invited") {
    data.status = "active";
  }

  const row = await prisma.practicePatientLink.update({
    where: { id: linkId },
    data,
    include: includePatientPortal,
  });

  const { grantConsentRecord } = await import("../consent/consentRecordService.js");
  const { LEGACY_SCOPE_TO_CONSENT_TYPE } = await import("../consent/consentTypes.js");
  for (const scope of scopes) {
    const consentType = LEGACY_SCOPE_TO_CONSENT_TYPE[scope];
    if (consentType) {
      await grantConsentRecord({
        patientUserId,
        practicePatientLinkId: linkId,
        consentType,
      });
    }
  }

  return linkToPatientJson(row);
}
