import { PrismaClient } from "@prisma/client";
import { INTERPRETER_CLOUD_CONSENT_VERSION } from "../../config/interpreterCloudEnv.js";
import { writeAuditLog } from "../auditLogService.js";

const prisma = new PrismaClient();

const CONSENT_TYPE = "interpreter_cloud_storage";

/**
 * @param {import("@prisma/client").ConsentRecord} row
 */
export function interpreterConsentRecordToJson(row) {
  return {
    id: row.id,
    consentType: row.consentType,
    status: row.status,
    grantedAt: row.grantedAt?.toISOString?.() ?? row.grantedAt,
    revokedAt: row.revokedAt?.toISOString?.() ?? row.revokedAt,
    version: row.version,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  };
}

/**
 * Revoke any prior granted interpreter cloud consent rows for this user.
 * @param {string} userId
 */
async function revokePriorGrantedRecords(userId, revokedByUserId) {
  const now = new Date();
  await prisma.consentRecord.updateMany({
    where: {
      patientUserId: userId,
      consentType: CONSENT_TYPE,
      status: "granted",
      practicePatientLinkId: null,
      practiceProfileId: null,
    },
    data: {
      status: "revoked",
      revokedAt: now,
      revokedByUserId,
    },
  });
}

/**
 * @param {string} userId
 * @param {import('express').Request} [req]
 * @param {{ source?: string }} [meta]
 */
export async function recordInterpreterCloudConsentGranted(userId, req, meta = {}) {
  const uid = String(userId || "").trim();
  if (!uid) return null;

  const now = new Date();
  await revokePriorGrantedRecords(uid, uid);

  const row = await prisma.consentRecord.create({
    data: {
      patientUserId: uid,
      consentType: CONSENT_TYPE,
      status: "granted",
      grantedAt: now,
      grantedByUserId: uid,
      version: INTERPRETER_CLOUD_CONSENT_VERSION,
      metadataJson: {
        source: meta.source || "interpreter_data_control",
      },
    },
  });

  await writeAuditLog({
    req,
    userId: uid,
    actorRole: "patient",
    action: "interpreter_cloud_consent_record_granted",
    entityType: "consent_record",
    entityId: row.id,
    patientUserId: uid,
    metadata: {
      consentVersion: INTERPRETER_CLOUD_CONSENT_VERSION,
      source: meta.source || "interpreter_data_control",
    },
  });

  return interpreterConsentRecordToJson(row);
}

/**
 * @param {string} userId
 * @param {import('express').Request} [req]
 * @param {{ source?: string; deleteCloudData?: boolean }} [meta]
 */
export async function recordInterpreterCloudConsentRevoked(userId, req, meta = {}) {
  const uid = String(userId || "").trim();
  if (!uid) return null;

  const now = new Date();
  await revokePriorGrantedRecords(uid, uid);

  const row = await prisma.consentRecord.create({
    data: {
      patientUserId: uid,
      consentType: CONSENT_TYPE,
      status: "revoked",
      grantedAt: now,
      revokedAt: now,
      revokedByUserId: uid,
      version: INTERPRETER_CLOUD_CONSENT_VERSION,
      metadataJson: {
        source: meta.source || "interpreter_data_control",
        deleteCloudDataRequested: meta.deleteCloudData === true,
      },
    },
  });

  await writeAuditLog({
    req,
    userId: uid,
    actorRole: "patient",
    action: "interpreter_cloud_consent_record_revoked",
    entityType: "consent_record",
    entityId: row.id,
    patientUserId: uid,
    metadata: {
      consentVersion: INTERPRETER_CLOUD_CONSENT_VERSION,
      deleteCloudData: meta.deleteCloudData === true,
    },
  });

  return interpreterConsentRecordToJson(row);
}

/**
 * @param {string} userId
 * @param {{ limit?: number }} [opts]
 */
export async function listInterpreterCloudConsentHistory(userId, opts = {}) {
  const uid = String(userId || "").trim();
  if (!uid) return [];

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const rows = await prisma.consentRecord.findMany({
    where: {
      patientUserId: uid,
      consentType: CONSENT_TYPE,
      practicePatientLinkId: null,
      practiceProfileId: null,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map(interpreterConsentRecordToJson);
}
