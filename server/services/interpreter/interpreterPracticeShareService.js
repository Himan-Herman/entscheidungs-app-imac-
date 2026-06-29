/**
 * Medical Interpreter — consent-based practice session sharing (Phase 4).
 * Communication documentation only; no diagnosis/triage/treatment content paths.
 */

import { isMedicalInterpreterB2bEnabled } from "../../config/featureFlags.js";
import {
  INTERPRETER_PRACTICE_SHARE_METADATA_VERSION,
} from "../../config/interpreterPracticeShareEnv.js";
import {
  encryptInterpreterCloudPayload,
  decryptInterpreterCloudPayload,
  isInterpreterCloudEncryptionConfigured,
} from "../../utils/interpreterCloudCrypto.js";
import { hashInterpreterInviteToken } from "../../utils/interpreterInviteToken.js";
import {
  findInviteByIdForPractice,
  findInviteByTokenHash,
  recordInviteUsage,
} from "./interpreterPracticeInviteRepository.js";
import { isValidInterpreterInviteTokenFormat } from "../../utils/interpreterInviteToken.js";
import { resolveEffectiveStatus } from "./interpreterPracticeInviteService.js";
import { auditInterpreterPracticeInvite } from "./interpreterPracticeInviteAudit.js";
import { auditInterpreterPracticeShare } from "./interpreterPracticeShareAudit.js";
import {
  grantInterpreterPracticeShareConsent,
  revokeInterpreterPracticeShareConsent,
} from "./interpreterPracticeShareConsent.js";
import {
  createSessionLinkRow,
  deleteSharePayload,
  findSessionLinkByClientSession,
  findSessionLinkForPatient,
  findSessionLinkForPractice,
  listSessionLinksForPatient,
  isActivePracticeProfile,
  listSessionLinksForPractice,
  sessionLinkToListDto,
  updateSessionLinkRow,
  upsertSharePayload,
} from "./interpreterPracticeShareRepository.js";
import { validatePracticeShareSessionBody } from "./interpreterPracticeShareValidation.js";
import { getPublicInterpreterInviteStatus } from "./interpreterPracticeInviteService.js";
import { getClientIp } from "../../middleware/ipRateLimit.js";
import { hashClientIp } from "../auditLogService.js";

const COMMUNICATION_NOTICE =
  "Multilingual communication support only. This is not medical diagnosis, triage, or treatment advice.";

const DOCUMENTATION_LABEL =
  "Conversation documentation — translated conversation record for communication support.";

function encryptionUnavailable() {
  return {
    ok: false,
    status: 503,
    error: "interpreter_share_encryption_not_configured",
    message: "Session sharing encryption is not configured.",
  };
}

/**
 * Resolves practice share target from invite token or matched invite+practice pair.
 * Prevents sharing to arbitrary practice IDs without invite context.
 * @param {unknown} body
 */
export async function resolvePracticeShareContext(body) {
  const token = String(body?.inviteToken || "").trim();
  const inviteId = String(body?.inviteId || "").trim();
  const practiceProfileId = String(body?.practiceProfileId || "").trim();

  if (token && isValidInterpreterInviteTokenFormat(token)) {
    const invite = await findInviteByTokenHash(hashInterpreterInviteToken(token));
    if (!invite?.practiceProfile?.isActive) {
      return {
        ok: false,
        status: 400,
        error: "invalid_invite",
        message: "Invitation is not valid.",
      };
    }
    if (resolveEffectiveStatus(invite) !== "active") {
      return {
        ok: false,
        status: 400,
        error: "invite_not_active",
        message: "Invitation is not active.",
      };
    }
    return {
      ok: true,
      practiceProfileId: invite.practiceProfileId,
      inviteId: invite.id,
    };
  }

  if (inviteId && practiceProfileId) {
    const invite = await findInviteByIdForPractice(inviteId, practiceProfileId);
    if (!invite) {
      return {
        ok: false,
        status: 400,
        error: "invalid_invite",
        message: "Invitation does not match this practice.",
      };
    }
    if (resolveEffectiveStatus(invite) !== "active") {
      return {
        ok: false,
        status: 400,
        error: "invite_not_active",
        message: "Invitation is not active.",
      };
    }
    return { ok: true, practiceProfileId, inviteId };
  }

  return {
    ok: false,
    status: 403,
    error: "invite_context_required",
    message:
      "Practice sharing requires a valid invitation link context. Open the practice invite again.",
  };
}

/**
 * @param {import('express').Request} req
 * @param {string} token
 */
export async function startInterpreterInviteSession(req, token) {
  const status = await getPublicInterpreterInviteStatus(req, token);
  if (!status.valid) {
    return { ok: true, started: false, ...status };
  }

  const tokenHash = hashInterpreterInviteToken(token);
  const invite = await findInviteByTokenHash(tokenHash);
  if (!invite || resolveEffectiveStatus(invite) !== "active") {
    return { ok: true, started: false, valid: false, state: "invalid" };
  }

  const ipHash = hashClientIp(getClientIp(req));
  await recordInviteUsage(invite.id, ipHash);

  auditInterpreterPracticeInvite({
    req,
    practiceProfileId: invite.practiceProfileId,
    action: "interpreter_practice_invite_used",
    entityId: invite.id,
    result: "ok",
    metadata: { usageCount: invite.usageCount + 1 },
  });

  return {
    ok: true,
    started: true,
    valid: true,
    state: "active",
    practiceDisplayName: status.practiceDisplayName,
    communicationNotice: COMMUNICATION_NOTICE,
    message: "You can continue to the interpreter. Sharing with the practice requires separate consent.",
    interpreterEnabled: status.interpreterEnabled,
  };
}

/**
 * @param {import('express').Request} req
 * @param {string} token
 * @param {string} patientUserId
 * @param {unknown} body
 */
export async function grantPracticeShareViaInvite(req, token, patientUserId, body) {
  if (!isMedicalInterpreterB2bEnabled()) {
    return {
      ok: false,
      status: 503,
      error: "medical_interpreter_b2b_disabled",
      message: "Practice sharing is not available.",
    };
  }
  if (!isInterpreterCloudEncryptionConfigured()) {
    return encryptionUnavailable();
  }

  const tokenHash = hashInterpreterInviteToken(token);
  const invite = await findInviteByTokenHash(tokenHash);
  if (!invite?.practiceProfile?.isActive) {
    return {
      ok: false,
      status: 400,
      error: "invalid_invite",
      message: "Invitation is not valid.",
    };
  }
  if (resolveEffectiveStatus(invite) !== "active") {
    return {
      ok: false,
      status: 400,
      error: "invite_not_active",
      message: "Invitation is not active.",
    };
  }

  return grantPracticeShareForPatient(req, patientUserId, invite.practiceProfileId, invite.id, body);
}

/**
 * @param {import('express').Request} req
 * @param {string} patientUserId
 * @param {string} practiceProfileId
 * @param {string | null} inviteId
 * @param {unknown} body
 */
export async function grantPracticeShareForPatient(
  req,
  patientUserId,
  practiceProfileId,
  inviteId,
  body,
) {
  if (!isMedicalInterpreterB2bEnabled()) {
    return {
      ok: false,
      status: 503,
      error: "medical_interpreter_b2b_disabled",
      message: "Practice sharing is not available.",
    };
  }
  if (!isInterpreterCloudEncryptionConfigured()) {
    return encryptionUnavailable();
  }

  if (!(await isActivePracticeProfile(practiceProfileId))) {
    return {
      ok: false,
      status: 400,
      error: "invalid_practice",
      message: "Practice is not available for sharing.",
    };
  }

  /** @type {Record<string, unknown>} */
  const sessionPayload =
    body && typeof body === "object" && !Array.isArray(body)
      ? { ...body }
      : {};
  delete sessionPayload.inviteToken;
  delete sessionPayload.inviteId;
  delete sessionPayload.practiceProfileId;

  const validation = validatePracticeShareSessionBody(sessionPayload);
  if (!validation.ok) {
    auditInterpreterPracticeShare({
      req,
      userId: patientUserId,
      patientUserId,
      practiceProfileId,
      action: "interpreter_practice_share_grant_failed",
      result: "failed",
      metadata: { reasonCode: validation.code },
    });
    return {
      ok: false,
      status: validation.statusCode || 400,
      error: validation.code,
      message: validation.message,
    };
  }

  const { session } = validation;
  const clientSessionId = session.clientSessionId;

  let link = await findSessionLinkByClientSession(
    practiceProfileId,
    patientUserId,
    clientSessionId,
  );

  const consentRow = await grantInterpreterPracticeShareConsent({
    patientUserId,
    practiceProfileId,
    inviteId,
    req,
  });

  const now = new Date();
  if (!link) {
    link = await createSessionLinkRow({
      practiceProfileId,
      patientUserId,
      inviteId: inviteId || null,
      clientSessionId,
      consentRecordId: consentRow.id,
      consentStatus: "granted",
      consentGrantedAt: now,
      consentRevokedAt: null,
      revokedByUserId: null,
      metadataVersion: INTERPRETER_PRACTICE_SHARE_METADATA_VERSION,
    });
  } else {
    link = await updateSessionLinkRow(link.id, {
      inviteId: inviteId || link.inviteId,
      consentRecordId: consentRow.id,
      consentStatus: "granted",
      consentGrantedAt: now,
      consentRevokedAt: null,
      revokedByUserId: null,
    });
  }

  const payloadJson = JSON.stringify({
    schemaVersion: session.schemaVersion,
    clientSessionId,
    status: session.status,
    patientLanguage: session.patientLanguage,
    doctorLanguage: session.doctorLanguage,
    conversationTitle: session.conversationTitle,
    doctorName: session.doctorName,
    practiceName: session.practiceName,
    specialty: session.specialty,
    appointmentDateTime: session.appointmentDateTime,
    endedAt: session.endedAt,
    turns: session.turns,
    documentationLabel: DOCUMENTATION_LABEL,
    communicationNotice: COMMUNICATION_NOTICE,
  });

  const enc = encryptInterpreterCloudPayload(payloadJson, {
    userId: patientUserId,
    sessionId: link.id,
  });
  if (!enc) {
    return encryptionUnavailable();
  }

  await upsertSharePayload(link.id, {
    payloadEnc: enc.payloadEnc,
    checksumSha256: enc.checksumSha256,
    schemaVersion: session.schemaVersion,
    turnCount: session.turnCount,
    charCount: session.charCount,
    patientLanguage: session.patientLanguage,
    doctorLanguage: session.doctorLanguage,
    sessionStatus: session.status,
  });

  auditInterpreterPracticeShare({
    req,
    userId: patientUserId,
    patientUserId,
    practiceProfileId,
    action: "interpreter_practice_share_granted",
    entityId: link.id,
    result: "ok",
    metadata: { clientSessionId, inviteId: inviteId || undefined },
  });

  return {
    ok: true,
    linkId: link.id,
    consentStatus: "granted",
    consentGrantedAt: now.toISOString(),
    message:
      "Conversation documentation shared with the practice. You can revoke access at any time.",
    communicationNotice: COMMUNICATION_NOTICE,
  };
}

/**
 * @param {import('express').Request} req
 * @param {string} patientUserId
 * @param {string} linkId
 * @param {{ deleteSharedCopy?: boolean }} [opts]
 */
export async function revokePracticeShareForPatient(req, patientUserId, linkId, opts = {}) {
  const link = await findSessionLinkForPatient(linkId, patientUserId);
  if (!link) {
    return {
      ok: false,
      status: 404,
      error: "not_found",
      message: "Sharing link not found.",
    };
  }

  const now = new Date();
  if (link.consentRecordId) {
    await revokeInterpreterPracticeShareConsent(
      link.consentRecordId,
      patientUserId,
      req,
    ).catch(() => {});
  }

  await updateSessionLinkRow(link.id, {
    consentStatus: "revoked",
    consentRevokedAt: now,
    revokedByUserId: patientUserId,
  });

  if (opts.deleteSharedCopy === true) {
    await deleteSharePayload(link.id);
  }

  auditInterpreterPracticeShare({
    req,
    userId: patientUserId,
    patientUserId,
    practiceProfileId: link.practiceProfileId,
    action: "interpreter_practice_share_revoked",
    entityId: link.id,
    result: "ok",
    metadata: {
      reasonCode: opts.deleteSharedCopy ? "revoked_and_deleted_copy" : "revoked",
    },
  });

  return {
    ok: true,
    linkId: link.id,
    consentStatus: "revoked",
    message: "Practice access to this conversation documentation has been revoked.",
  };
}

/**
 * @param {string} practiceProfileId
 */
export async function listPracticeSharedSessions(practiceProfileId) {
  const rows = await listSessionLinksForPractice(practiceProfileId, {
    consentStatus: "granted",
  });
  return {
    ok: true,
    sessions: rows.map(sessionLinkToListDto),
    communicationNotice: COMMUNICATION_NOTICE,
    documentationLabel: DOCUMENTATION_LABEL,
  };
}

/**
 * @param {import('express').Request} req
 * @param {string} practiceProfileId
 * @param {string} viewerUserId
 * @param {string} linkId
 */
export async function getPracticeSharedSessionDetail(
  req,
  practiceProfileId,
  viewerUserId,
  linkId,
) {
  const link = await findSessionLinkForPractice(linkId, practiceProfileId);
  if (!link || link.consentStatus !== "granted") {
    auditInterpreterPracticeShare({
      req,
      userId: viewerUserId,
      practiceProfileId,
      action: "interpreter_practice_session_view_denied",
      entityId: linkId,
      result: "denied",
      metadata: { reasonCode: link ? "consent_not_granted" : "not_found" },
    });
    return {
      ok: false,
      status: link ? 403 : 404,
      error: link ? "consent_required" : "not_found",
      message: link
        ? "Patient consent is required to view this conversation documentation."
        : "Session not found.",
    };
  }

  if (!link.payload) {
    return {
      ok: false,
      status: 404,
      error: "no_shared_payload",
      message: "No shared conversation documentation is available.",
    };
  }

  const plaintext = decryptInterpreterCloudPayload(link.payload.payloadEnc, {
    userId: link.patientUserId,
    sessionId: link.id,
  });
  if (!plaintext) {
    auditInterpreterPracticeShare({
      req,
      userId: viewerUserId,
      practiceProfileId,
      action: "interpreter_practice_session_view_failed",
      entityId: linkId,
      result: "failed",
      metadata: { reasonCode: "decrypt_failed" },
    });
    return {
      ok: false,
      status: 500,
      error: "decrypt_failed",
      message: "Could not read shared conversation documentation.",
    };
  }

  let documentation;
  try {
    documentation = JSON.parse(plaintext);
  } catch {
    return {
      ok: false,
      status: 500,
      error: "invalid_payload",
      message: "Shared documentation is unavailable.",
    };
  }

  auditInterpreterPracticeShare({
    req,
    userId: viewerUserId,
    practiceProfileId,
    action: "interpreter_practice_session_viewed",
    entityId: linkId,
    result: "ok",
    metadata: { clientSessionId: link.clientSessionId },
  });

  return {
    ok: true,
    session: {
      id: link.id,
      clientSessionId: link.clientSessionId,
      consentGrantedAt: link.consentGrantedAt?.toISOString(),
      patientLanguage: link.payload.patientLanguage,
      doctorLanguage: link.payload.doctorLanguage,
      sessionStatus: link.payload.sessionStatus,
      turnCount: link.payload.turnCount,
      documentationLabel: DOCUMENTATION_LABEL,
      communicationNotice: COMMUNICATION_NOTICE,
      verificationNotice:
        "Verify translations with participants. This is not a medical record or clinical assessment.",
      conversation: documentation,
    },
  };
}

/**
 * @param {import('express').Request} req
 * @param {string} practiceProfileId
 * @param {string} staffUserId
 * @param {string} linkId
 */
export async function revokePracticeSessionLinkByPractice(
  req,
  practiceProfileId,
  staffUserId,
  linkId,
) {
  const link = await findSessionLinkForPractice(linkId, practiceProfileId);
  if (!link) {
    return {
      ok: false,
      status: 404,
      error: "not_found",
      message: "Session link not found.",
    };
  }

  const now = new Date();
  await updateSessionLinkRow(link.id, {
    consentStatus: "revoked",
    consentRevokedAt: now,
    revokedByUserId: staffUserId,
  });
  await deleteSharePayload(link.id);

  auditInterpreterPracticeShare({
    req,
    userId: staffUserId,
    practiceProfileId,
    action: "interpreter_practice_session_link_revoked",
    entityId: link.id,
    result: "ok",
    metadata: { reasonCode: "practice_admin_revoke" },
  });

  return {
    ok: true,
    linkId: link.id,
    consentStatus: "revoked",
    message: "Shared conversation documentation removed from practice access.",
  };
}

/**
 * @param {string} patientUserId
 */
export async function listPatientPracticeShares(patientUserId) {
  const rows = await listSessionLinksForPatient(patientUserId);
  return {
    ok: true,
    shares: rows.map((row) => ({
      id: row.id,
      practiceProfileId: row.practiceProfileId,
      practiceDisplayName:
        row.practiceProfile?.displayNameForPatients ||
        row.practiceProfile?.practiceName ||
        "Practice",
      clientSessionId: row.clientSessionId,
      consentStatus: row.consentStatus,
      consentGrantedAt: row.consentGrantedAt?.toISOString(),
      consentRevokedAt: row.consentRevokedAt?.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

/**
 * @param {string} practiceProfileId
 */
export async function getPracticeInterpreterProfile(practiceProfileId) {
  const { prisma } = await import("../../lib/prisma.js");
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceProfileId },
    select: {
      id: true,
      practiceName: true,
      displayNameForPatients: true,
      isActive: true,
    },
  });
  if (!practice?.isActive) {
    return { ok: false, status: 404, error: "not_found", message: "Practice not found." };
  }
  return {
    ok: true,
    profile: {
      practiceDisplayName:
        practice.displayNameForPatients || practice.practiceName,
      communicationNotice: COMMUNICATION_NOTICE,
      documentationLabel: DOCUMENTATION_LABEL,
      boundaries: {
        noDiagnosis: true,
        noTriage: true,
        noTreatment: true,
        noAudioSharing: true,
        consentRequired: true,
      },
    },
  };
}
