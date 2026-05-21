/**
 * Medical Interpreter practice invite lifecycle (Phase 4.6).
 * No patient transcript, session content, or clinical data.
 */

import { isMedicalInterpreterEnabled } from "../../config/featureFlags.js";
import {
  INTERPRETER_INVITE_DEFAULT_TTL_HOURS,
  INTERPRETER_INVITE_MAX_PER_PRACTICE,
  INTERPRETER_INVITE_MAX_TTL_HOURS,
  INTERPRETER_INVITE_METADATA_VERSION,
  INTERPRETER_INVITE_MIN_TTL_HOURS,
  INTERPRETER_INVITE_TYPES,
} from "../../config/interpreterInviteEnv.js";
import {
  generateInterpreterInviteToken,
  hashInterpreterInviteToken,
  interpreterInviteTokenPrefix,
  isValidInterpreterInviteTokenFormat,
} from "../../utils/interpreterInviteToken.js";
import { auditInterpreterPracticeInvite } from "./interpreterPracticeInviteAudit.js";
import {
  countActiveInvites,
  createInviteRow,
  findInviteByIdForPractice,
  findInviteByTokenHash,
  inviteToListDto,
  listInvitesByPractice,
  updateInviteRow,
} from "./interpreterPracticeInviteRepository.js";

const COMMUNICATION_NOTICE =
  "Multilingual communication support only. This is not medical diagnosis, triage, or treatment advice.";

const INVALID_PUBLIC_STATUS = {
  ok: true,
  valid: false,
  state: "invalid",
  communicationNotice: COMMUNICATION_NOTICE,
  message: "This invitation link is not available.",
  interpreterEnabled: isMedicalInterpreterEnabled(),
};

/**
 * @param {import('@prisma/client').PracticeInterpreterInvite & { practiceProfile?: { practiceName: string; displayNameForPatients: string | null; isActive: boolean } }} row
 */
export function resolveEffectiveStatus(row) {
  if (row.status === "revoked") return "revoked";
  if (row.status === "expired") return "expired";
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  if (row.maxUses != null && row.usageCount >= row.maxUses) {
    return "expired";
  }
  return row.status === "active" ? "active" : "invalid";
}

/**
 * @param {string | undefined} displayNameForPatients
 * @param {string} practiceName
 */
function publicPracticeDisplayName(displayNameForPatients, practiceName) {
  const d = String(displayNameForPatients || "").trim();
  if (d) return d.slice(0, 120);
  return String(practiceName || "").trim().slice(0, 120) || "Medical practice";
}

/**
 * @param {import('express').Request} [req]
 * @param {string} practiceProfileId
 * @param {string} userId
 * @param {{
 *   displayName?: string;
 *   inviteType?: string;
 *   ttlHours?: number;
 *   maxUses?: number | null;
 * }} body
 */
export async function createPracticeInterpreterInvite(
  req,
  practiceProfileId,
  userId,
  body,
) {
  const inviteType = String(body.inviteType || "other").trim();
  if (!INTERPRETER_INVITE_TYPES.has(inviteType)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_invite_type",
      message: "Invalid invite type.",
    };
  }

  const ttlHours = Number(body.ttlHours ?? INTERPRETER_INVITE_DEFAULT_TTL_HOURS);
  if (
    !Number.isFinite(ttlHours) ||
    ttlHours < INTERPRETER_INVITE_MIN_TTL_HOURS ||
    ttlHours > INTERPRETER_INVITE_MAX_TTL_HOURS
  ) {
    return {
      ok: false,
      status: 400,
      error: "invalid_ttl",
      message: "Invite lifetime is out of allowed range.",
    };
  }

  let maxUses = null;
  if (body.maxUses != null && body.maxUses !== "") {
    const n = Number(body.maxUses);
    if (!Number.isInteger(n) || n < 1 || n > 10_000) {
      return {
        ok: false,
        status: 400,
        error: "invalid_max_uses",
        message: "Invalid maximum uses.",
      };
    }
    maxUses = n;
  }

  const activeCount = await countActiveInvites(practiceProfileId);
  if (activeCount >= INTERPRETER_INVITE_MAX_PER_PRACTICE) {
    return {
      ok: false,
      status: 409,
      error: "invite_limit_reached",
      message: "Maximum number of active invites reached for this practice.",
    };
  }

  const displayName = String(body.displayName || "").trim().slice(0, 80) || null;
  const plainToken = generateInterpreterInviteToken();
  const tokenHash = hashInterpreterInviteToken(plainToken);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const row = await createInviteRow({
    practiceProfileId,
    createdByUserId: userId,
    displayName,
    inviteType,
    tokenHash,
    tokenPrefix: interpreterInviteTokenPrefix(plainToken),
    status: "active",
    expiresAt,
    maxUses,
    usageCount: 0,
    metadataVersion: INTERPRETER_INVITE_METADATA_VERSION,
  });

  auditInterpreterPracticeInvite({
    req,
    userId,
    practiceProfileId,
    action: "interpreter_practice_invite_created",
    entityId: row.id,
    result: "ok",
    metadata: {
      inviteType,
      maxUses: maxUses ?? undefined,
    },
  });

  const invitePath = `/i/interpreter/${plainToken}`;

  return {
    ok: true,
    status: 201,
    invite: inviteToListDto(row),
    /** Shown once — never stored in plaintext. */
    token: plainToken,
    invitePath,
    message:
      "Invite created. Copy the link now; the full token cannot be retrieved later.",
  };
}

/**
 * @param {string} practiceProfileId
 */
export async function listPracticeInterpreterInvites(practiceProfileId) {
  const rows = await listInvitesByPractice(practiceProfileId);
  return {
    ok: true,
    invites: rows.map(inviteToListDto),
  };
}

/**
 * @param {import('express').Request} [req]
 * @param {string} practiceProfileId
 * @param {string} userId
 * @param {string} inviteId
 */
export async function revokePracticeInterpreterInvite(
  req,
  practiceProfileId,
  userId,
  inviteId,
) {
  const row = await findInviteByIdForPractice(inviteId, practiceProfileId);
  if (!row) {
    return {
      ok: false,
      status: 404,
      error: "not_found",
      message: "Invite not found.",
    };
  }

  if (row.status === "revoked") {
    return {
      ok: true,
      invite: inviteToListDto(row),
      message: "Invite is already revoked.",
    };
  }

  const updated = await updateInviteRow(row.id, {
    status: "revoked",
    revokedAt: new Date(),
    revokedByUserId: userId,
  });

  auditInterpreterPracticeInvite({
    req,
    userId,
    practiceProfileId,
    action: "interpreter_practice_invite_revoked",
    entityId: row.id,
    result: "ok",
    metadata: { inviteType: row.inviteType },
  });

  return {
    ok: true,
    invite: inviteToListDto(updated),
    message: "Invite revoked.",
  };
}

/**
 * Public token validation — minimal safe fields only.
 * @param {import('express').Request} [req]
 * @param {string} token
 */
export async function getPublicInterpreterInviteStatus(req, token) {
  if (!isValidInterpreterInviteTokenFormat(token)) {
    auditInterpreterPracticeInvite({
      req,
      action: "interpreter_practice_invite_validated",
      result: "ok",
      metadata: { state: "invalid" },
    });
    return { ...INVALID_PUBLIC_STATUS };
  }

  const tokenHash = hashInterpreterInviteToken(token);
  const row = await findInviteByTokenHash(tokenHash);

  if (!row || !row.practiceProfile?.isActive) {
    auditInterpreterPracticeInvite({
      req,
      action: "interpreter_practice_invite_validated",
      result: "ok",
      metadata: { state: "invalid" },
    });
    return { ...INVALID_PUBLIC_STATUS };
  }

  const state = resolveEffectiveStatus(row);

  if (state === "expired") {
    if (row.status === "active") {
      await updateInviteRow(row.id, { status: "expired" }).catch(() => {});
    }
    auditInterpreterPracticeInvite({
      req,
      practiceProfileId: row.practiceProfileId,
      action: "interpreter_practice_invite_expired",
      entityId: row.id,
      result: "ok",
      metadata: { state: "expired" },
    });
    return {
      ok: true,
      valid: false,
      state: "expired",
      communicationNotice: COMMUNICATION_NOTICE,
      message: "This invitation link has expired.",
      interpreterEnabled: isMedicalInterpreterEnabled(),
    };
  }

  if (state === "revoked") {
    auditInterpreterPracticeInvite({
      req,
      practiceProfileId: row.practiceProfileId,
      action: "interpreter_practice_invite_validated",
      entityId: row.id,
      result: "ok",
      metadata: { state: "revoked" },
    });
    return {
      ok: true,
      valid: false,
      state: "revoked",
      communicationNotice: COMMUNICATION_NOTICE,
      message: "This invitation link is no longer available.",
      interpreterEnabled: isMedicalInterpreterEnabled(),
    };
  }

  if (state !== "active") {
    auditInterpreterPracticeInvite({
      req,
      action: "interpreter_practice_invite_validated",
      result: "ok",
      metadata: { state: "invalid" },
    });
    return { ...INVALID_PUBLIC_STATUS };
  }

  auditInterpreterPracticeInvite({
    req,
    practiceProfileId: row.practiceProfileId,
    action: "interpreter_practice_invite_validated",
    entityId: row.id,
    result: "ok",
    metadata: { state: "active" },
  });

  return {
    ok: true,
    valid: true,
    state: "active",
    practiceDisplayName: publicPracticeDisplayName(
      row.practiceProfile.displayNameForPatients,
      row.practiceProfile.practiceName,
    ),
    communicationNotice: COMMUNICATION_NOTICE,
    message: "Invitation link is valid.",
    interpreterEnabled: isMedicalInterpreterEnabled(),
  };
}
