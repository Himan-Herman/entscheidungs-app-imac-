/**
 * Medical Interpreter cloud session service (business logic).
 * - Consent-based writes only (account consent + per-request cloudStorageConsent).
 * - Deletes allowed after revoke.
 * - No audio persistence; encrypted turn payloads only.
 */

import {
  INTERPRETER_CLOUD_MAX_SESSIONS_PER_USER,
  INTERPRETER_CLOUD_SCHEMA_VERSION,
} from "../../config/interpreterCloudEnv.js";
import {
  decryptInterpreterCloudPayload,
  encryptInterpreterCloudPayload,
  isInterpreterCloudEncryptionConfigured,
} from "../../utils/interpreterCloudCrypto.js";
import { auditInterpreterCloud } from "./interpreterCloudAudit.js";
import { getCloudStorageStatus } from "./interpreterCloudStatus.js";
import {
  countActiveCloudSessions,
  countAllCloudSessions,
  createCloudSessionPayload,
  createCloudSessionRow,
  deleteAllCloudSessionRows,
  deleteCloudSessionRowById,
  findCloudPreference,
  findCloudSessionByClientId,
  findCloudSessionUnique,
  findCloudSessionWithPayload,
  listCloudSessionRows,
  updateCloudSessionWithPayload,
} from "./interpreterCloudSessionRepository.js";

export {
  getCloudPreference,
  grantCloudConsent,
  revokeCloudConsent,
  getCloudConsentHistory,
} from "./interpreterCloudConsentService.js";

export { getCloudStorageStatus } from "./interpreterCloudStatus.js";

function encryptionUnavailable() {
  return {
    ok: false,
    code: "interpreter_cloud_encryption_not_configured",
    message: "Cloud storage encryption is not configured.",
    statusCode: 503,
  };
}

/**
 * @param {import('@prisma/client').InterpreterCloudSession} row
 */
function toSessionMetadataDto(row) {
  return {
    id: row.id,
    sessionId: row.clientSessionId,
    clientSessionId: row.clientSessionId,
    status: row.status,
    patientLanguage: row.patientLanguage,
    doctorLanguage: row.doctorLanguage,
    conversationTitle: row.conversationTitle ?? undefined,
    doctorName: row.doctorName ?? undefined,
    practiceName: row.practiceName ?? undefined,
    specialty: row.specialty ?? undefined,
    appointmentDateTime: row.appointmentDateTime?.toISOString() ?? undefined,
    profileConsentUsed: row.profileConsentUsed,
    cloudStorageConsent: row.cloudStorageConsent,
    schemaVersion: row.schemaVersion,
    endedAt: row.endedAt?.toISOString() ?? undefined,
    turnCount: row.turnCount,
    charCount: row.charCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Account-level consent must be active; per-save consent is validated separately.
 * @param {string} userId
 */
async function assertCloudWriteAllowed(userId) {
  if (!isInterpreterCloudEncryptionConfigured()) {
    return encryptionUnavailable();
  }
  const pref = await findCloudPreference(userId);
  if (!pref?.cloudEnabled) {
    return {
      ok: false,
      code: "interpreter_cloud_consent_required",
      message: "Cloud storage consent is required.",
      statusCode: 403,
    };
  }
  return { ok: true };
}

/**
 * @param {object} s — validated.session
 */
function sessionRowFields(s) {
  return {
    status: s.status,
    patientLanguage: s.patientLanguage,
    doctorLanguage: s.doctorLanguage,
    organizationId: s.organizationId ?? null,
    practiceProfileId: s.practiceProfileId ?? null,
    conversationTitle: s.conversationTitle ?? null,
    doctorName: s.doctorName ?? null,
    practiceName: s.practiceName ?? null,
    specialty: s.specialty ?? null,
    appointmentDateTime: s.appointmentDateTime ?? null,
    profileConsentUsed: s.profileConsentUsed,
    cloudStorageConsent: true,
    schemaVersion: s.schemaVersion ?? INTERPRETER_CLOUD_SCHEMA_VERSION,
    endedAt: s.endedAt ?? null,
    turnCount: s.turnCount,
    charCount: s.charCount,
  };
}

/**
 * @param {string} userId
 * @param {{ ok: true, session: object }} validated
 */
async function persistEncryptedSession(userId, validated) {
  const consentCheck = await assertCloudWriteAllowed(userId);
  if (!consentCheck.ok) return consentCheck;

  const s = validated.session;
  const activeCount = await countActiveCloudSessions(userId);
  const existing = await findCloudSessionUnique(userId, s.clientSessionId);

  if (!existing && activeCount >= INTERPRETER_CLOUD_MAX_SESSIONS_PER_USER) {
    return {
      ok: false,
      code: "interpreter_cloud_quota_exceeded",
      message: "Cloud session limit reached.",
      statusCode: 429,
    };
  }

  const canonicalPayload = JSON.stringify({
    schemaVersion: s.schemaVersion,
    turns: s.turns,
  });

  if (existing) {
    const enc = encryptInterpreterCloudPayload(canonicalPayload, {
      userId,
      sessionId: existing.id,
    });
    if (!enc) return encryptionUnavailable();

    const updated = await updateCloudSessionWithPayload(
      existing.id,
      userId,
      sessionRowFields(s),
      enc,
    );
    return { ok: true, session: updated, created: false };
  }

  const created = await createCloudSessionRow({
    userId,
    clientSessionId: s.clientSessionId,
    ...sessionRowFields(s),
  });

  const enc = encryptInterpreterCloudPayload(canonicalPayload, {
    userId,
    sessionId: created.id,
  });
  if (!enc) {
    await deleteCloudSessionRowById(created.id);
    return encryptionUnavailable();
  }

  await createCloudSessionPayload(created.id, userId, enc);
  return { ok: true, session: created, created: true };
}

/**
 * @param {string} userId
 * @param {import('express').Request} [req]
 */
export async function createCloudSession(userId, validated, req) {
  const result = await persistEncryptedSession(userId, validated);
  if (!result.ok) {
    auditInterpreterCloud({
      req,
      userId,
      action: "interpreter_cloud_session_create_failed",
      result: "failed",
      metadata: {
        code: result.code,
        clientSessionId: validated.session.clientSessionId,
      },
    });
    return result;
  }

  auditInterpreterCloud({
    req,
    userId,
    action: "interpreter_cloud_session_created",
    entityId: result.session.id,
    result: "ok",
    metadata: {
      turnCount: result.session.turnCount,
      charCount: result.session.charCount,
      clientSessionId: validated.session.clientSessionId,
    },
  });

  return getCloudSessionByClientId(userId, validated.session.clientSessionId);
}

/**
 * @param {string} userId
 * @param {string} clientSessionId
 */
export async function updateCloudSession(userId, clientSessionId, validated, req) {
  const existing = await findCloudSessionByClientId(userId, clientSessionId);
  if (!existing) {
    return {
      ok: false,
      code: "interpreter_session_not_found",
      message: "Session not found.",
      statusCode: 404,
    };
  }

  if (validated.session.clientSessionId !== clientSessionId) {
    return {
      ok: false,
      code: "validation_session_id_mismatch",
      message: "sessionId in body must match URL.",
      statusCode: 400,
    };
  }

  const result = await persistEncryptedSession(userId, validated);
  if (!result.ok) {
    auditInterpreterCloud({
      req,
      userId,
      action: "interpreter_cloud_session_update_failed",
      entityId: existing.id,
      result: "failed",
      metadata: { code: result.code, clientSessionId },
    });
    return result;
  }

  auditInterpreterCloud({
    req,
    userId,
    action: "interpreter_cloud_session_updated",
    entityId: result.session.id,
    result: "ok",
    metadata: {
      turnCount: result.session.turnCount,
      charCount: result.session.charCount,
      clientSessionId,
    },
  });

  return getCloudSessionByClientId(userId, clientSessionId);
}

/**
 * @param {string} userId
 */
export async function listCloudSessions(userId) {
  const rows = await listCloudSessionRows(userId);
  return {
    ok: true,
    sessions: rows.map(toSessionMetadataDto),
  };
}

/**
 * @param {string} userId
 * @param {string} clientSessionId
 */
export async function getCloudSessionByClientId(userId, clientSessionId) {
  const row = await findCloudSessionWithPayload(userId, clientSessionId);
  if (!row) {
    return {
      ok: false,
      code: "interpreter_session_not_found",
      message: "Session not found.",
      statusCode: 404,
    };
  }

  if (!row.payload) {
    return {
      ok: false,
      code: "interpreter_cloud_payload_missing",
      message: "Session data is unavailable.",
      statusCode: 500,
    };
  }

  const plaintext = decryptInterpreterCloudPayload(row.payload.payloadEnc, {
    userId,
    sessionId: row.id,
  });
  if (!plaintext) {
    return {
      ok: false,
      code: "interpreter_cloud_decrypt_failed",
      message: "Session data could not be read.",
      statusCode: 500,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return {
      ok: false,
      code: "interpreter_cloud_payload_invalid",
      message: "Session data is corrupted.",
      statusCode: 500,
    };
  }

  return {
    ok: true,
    session: {
      ...toSessionMetadataDto(row),
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
    },
  };
}

/**
 * Deletes one cloud session — allowed even when account consent is revoked.
 * @param {string} userId
 * @param {string} clientSessionId
 */
export async function deleteCloudSession(userId, clientSessionId, req) {
  const row = await findCloudSessionByClientId(userId, clientSessionId);
  if (!row) {
    auditInterpreterCloud({
      req,
      userId,
      action: "interpreter_cloud_session_delete_denied",
      result: "denied",
      metadata: { code: "interpreter_session_not_found", clientSessionId },
    });
    return {
      ok: false,
      code: "interpreter_session_not_found",
      message: "Session not found.",
      statusCode: 404,
    };
  }

  await deleteCloudSessionRowById(row.id);

  auditInterpreterCloud({
    req,
    userId,
    action: "interpreter_cloud_session_deleted",
    entityId: row.id,
    result: "ok",
    metadata: { turnCount: row.turnCount, clientSessionId },
  });

  return { ok: true, deleted: true, sessionId: clientSessionId };
}

/**
 * @param {string} userId
 */
export async function deleteAllCloudSessions(userId, req) {
  const count = await countAllCloudSessions(userId);
  await deleteAllCloudSessionRows(userId);

  auditInterpreterCloud({
    req,
    userId,
    action: "interpreter_cloud_delete_all",
    result: "ok",
    metadata: { sessionCount: count },
  });

  return { ok: true, deleted: true, sessionCount: count };
}
