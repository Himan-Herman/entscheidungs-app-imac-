/**
 * Patient export of interpreter cloud sessions (JSON portability).
 * No audit/logging of transcript content.
 */

import { INTERPRETER_CLOUD_CONSENT_VERSION } from "../../config/interpreterCloudEnv.js";
import {
  decryptInterpreterCloudPayload,
  isInterpreterCloudEncryptionConfigured,
} from "../../utils/interpreterCloudCrypto.js";
import { auditInterpreterCloud } from "./interpreterCloudAudit.js";
import {
  findCloudPreference,
  listCloudSessionRowsWithPayload,
} from "./interpreterCloudSessionRepository.js";

export const INTERPRETER_CLOUD_EXPORT_SCHEMA_VERSION = "interpreter-cloud-export-v1";

/**
 * @param {import('@prisma/client').InterpreterCloudSession} row
 */
function sessionMetadataExport(row) {
  return {
    sessionId: row.clientSessionId,
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
    turnCount: row.turnCount,
    charCount: row.charCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? undefined,
  };
}

/**
 * @param {string} userId
 * @param {import('express').Request} [req]
 */
export async function exportInterpreterCloudSessions(userId, req) {
  if (!isInterpreterCloudEncryptionConfigured()) {
    return {
      ok: false,
      code: "interpreter_cloud_encryption_not_configured",
      message: "Cloud storage encryption is not configured.",
      statusCode: 503,
    };
  }

  const pref = await findCloudPreference(userId);
  const rows = await listCloudSessionRowsWithPayload(userId);

  /** @type {object[]} */
  const sessions = [];
  let totalTurns = 0;

  for (const row of rows) {
    const base = sessionMetadataExport(row);
    if (!row.payload) {
      sessions.push({ ...base, turns: [], exportWarning: "payload_missing" });
      continue;
    }

    const plaintext = decryptInterpreterCloudPayload(row.payload.payloadEnc, {
      userId,
      sessionId: row.id,
    });

    if (!plaintext) {
      sessions.push({ ...base, turns: [], exportWarning: "decrypt_failed" });
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(plaintext);
    } catch {
      sessions.push({ ...base, turns: [], exportWarning: "payload_invalid" });
      continue;
    }

    const turns = Array.isArray(parsed.turns) ? parsed.turns : [];
    totalTurns += turns.length;
    sessions.push({ ...base, turns });
  }

  auditInterpreterCloud({
    req,
    userId,
    action: "interpreter_cloud_export_completed",
    result: "ok",
    metadata: {
      sessionCount: sessions.length,
      turnCount: totalTurns,
    },
  });

  return {
    ok: true,
    export: {
      schemaVersion: INTERPRETER_CLOUD_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      consentVersion: pref?.consentVersion ?? INTERPRETER_CLOUD_CONSENT_VERSION,
      cloudEnabled: pref?.cloudEnabled === true,
      sessionCount: sessions.length,
      turnCount: totalTurns,
      disclaimer:
        "Communication documentation only — not a medical record, diagnosis, or treatment plan.",
      sessions,
    },
  };
}
