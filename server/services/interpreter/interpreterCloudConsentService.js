/**
 * Account-level cloud consent (grant/revoke/preference/history).
 * Separate from session CRUD — consent routes only enable/disable writes.
 */

import { isInterpreterCloudEncryptionConfigured } from "../../utils/interpreterCloudCrypto.js";
import { auditInterpreterCloud } from "./interpreterCloudAudit.js";
import {
  listInterpreterCloudConsentHistory,
  recordInterpreterCloudConsentGranted,
  recordInterpreterCloudConsentRevoked,
} from "./interpreterCloudConsentRecord.js";
import { INTERPRETER_CLOUD_CONSENT_VERSION } from "../../config/interpreterCloudEnv.js";
import {
  countActiveCloudSessions,
  countAllCloudSessions,
  deleteAllCloudSessionRows,
  findCloudPreference,
  upsertCloudPreferenceGranted,
  upsertCloudPreferenceRevoked,
} from "./interpreterCloudSessionRepository.js";
import { getCloudStorageStatus } from "./interpreterCloudStatus.js";

function encryptionUnavailable() {
  return {
    ok: false,
    code: "interpreter_cloud_encryption_not_configured",
    message: "Cloud storage encryption is not configured.",
    statusCode: 503,
  };
}

/**
 * @param {string} userId
 */
export async function getCloudPreference(userId) {
  const pref = await findCloudPreference(userId);
  const sessionCount = await countActiveCloudSessions(userId);
  return {
    ok: true,
    cloudEnabled: pref?.cloudEnabled === true,
    consentVersion: pref?.consentVersion ?? null,
    consentGrantedAt: pref?.consentGrantedAt?.toISOString() ?? null,
    consentRevokedAt: pref?.consentRevokedAt?.toISOString() ?? null,
    sessionCount,
    ...getCloudStorageStatus(),
  };
}

/**
 * @param {string} userId
 * @param {import('express').Request} [req]
 */
export async function grantCloudConsent(userId, req) {
  if (!isInterpreterCloudEncryptionConfigured()) {
    return encryptionUnavailable();
  }
  await upsertCloudPreferenceGranted(userId);
  await recordInterpreterCloudConsentGranted(userId, req, {
    source: "interpreter_cloud_grant",
  });
  auditInterpreterCloud({
    req,
    userId,
    action: "interpreter_cloud_consent_granted",
    result: "ok",
    metadata: { consentVersion: INTERPRETER_CLOUD_CONSENT_VERSION },
  });
  const pref = await getCloudPreference(userId);
  return {
    ...pref,
    consentHistory: await listInterpreterCloudConsentHistory(userId, {
      limit: 10,
    }),
  };
}

/**
 * @param {string} userId
 * @param {import('express').Request} [req]
 * @param {{ deleteCloudData?: boolean }} [opts]
 */
export async function revokeCloudConsent(userId, req, opts = {}) {
  await upsertCloudPreferenceRevoked(userId);

  let deletedSessionCount = 0;
  if (opts.deleteCloudData === true) {
    const count = await countAllCloudSessions(userId);
    await deleteAllCloudSessionRows(userId);
    deletedSessionCount = count;
    auditInterpreterCloud({
      req,
      userId,
      action: "interpreter_cloud_delete_all",
      result: "ok",
      metadata: { sessionCount: count, reason: "revoke_with_delete" },
    });
  }

  await recordInterpreterCloudConsentRevoked(userId, req, {
    source: "interpreter_cloud_revoke",
    deleteCloudData: opts.deleteCloudData === true,
  });

  auditInterpreterCloud({
    req,
    userId,
    action: "interpreter_cloud_consent_revoked",
    result: "ok",
    metadata: {
      deleteCloudData: opts.deleteCloudData === true,
      deletedSessionCount,
    },
  });

  const pref = await getCloudPreference(userId);
  return {
    ...pref,
    deletedSessionCount,
    consentHistory: await listInterpreterCloudConsentHistory(userId, {
      limit: 10,
    }),
  };
}

/**
 * @param {string} userId
 */
export async function getCloudConsentHistory(userId) {
  return {
    ok: true,
    records: await listInterpreterCloudConsentHistory(userId, { limit: 20 }),
  };
}
