import { PrismaClient } from "@prisma/client";
import {
  CARE_CONSENT_VERSION,
  isAllowedConsentVersion,
  normalizeConsentScopes,
} from "./consentScopes.js";

const prisma = new PrismaClient();

export const LINK_STATUSES = new Set(["invited", "active", "revoked", "archived"]);

const ACTIVE_LIKE = new Set(["invited", "active"]);

/**
 * @param {import("@prisma/client").PracticePatientLink & { patientUser?: object, patientProfile?: object | null }} row
 */
export function linkToJson(row) {
  const user = row.patientUser;
  return {
    id: row.id,
    practiceProfileId: row.practiceProfileId,
    patientUserId: row.patientUserId,
    patientProfileId: row.patientProfileId,
    status: row.status,
    linkedAt: row.linkedAt,
    revokedAt: row.revokedAt,
    consentVersion: row.consentVersion,
    consentAcceptedAt: row.consentAcceptedAt,
    consentScopes: Array.isArray(row.consentScopes) ? row.consentScopes : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    patient: user
      ? {
          id: user.id,
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
    select: {
      id: true,
      practiceName: true,
      publicSlug: true,
      specialty: true,
    },
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
    practice: practice
      ? {
          id: practice.id,
          practiceName: practice.practiceName,
          publicSlug: practice.publicSlug,
          specialty: practice.specialty,
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

  let status = "invited";
  if (input.status === "active" || input.status === "invited") {
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

  return createPracticePatientLink({
    practiceProfileId,
    patientUserId,
    patientProfileId,
    status: "active",
  });
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

  return linkToPatientJson(row);
}
