import { PrismaClient } from "@prisma/client";
import {
  INTERPRETER_PRACTICE_SHARE_CONSENT_TYPE,
  INTERPRETER_PRACTICE_SHARE_CONSENT_VERSION,
} from "../../config/interpreterPracticeShareEnv.js";
import { auditInterpreterPracticeShare } from "./interpreterPracticeShareAudit.js";

const prisma = new PrismaClient();

/**
 * @param {{
 *   patientUserId: string;
 *   practiceProfileId: string;
 *   inviteId?: string | null;
 *   req?: import('express').Request;
 * }} input
 */
export async function grantInterpreterPracticeShareConsent(input) {
  const patientUserId = String(input.patientUserId || "").trim();
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  if (!patientUserId || !practiceProfileId) {
    throw new Error("validation_required");
  }

  const now = new Date();

  await prisma.consentRecord.updateMany({
    where: {
      patientUserId,
      practiceProfileId,
      consentType: INTERPRETER_PRACTICE_SHARE_CONSENT_TYPE,
      status: "granted",
    },
    data: {
      status: "revoked",
      revokedAt: now,
      revokedByUserId: patientUserId,
    },
  });

  const row = await prisma.consentRecord.create({
    data: {
      patientUserId,
      practiceProfileId,
      practicePatientLinkId: null,
      consentType: INTERPRETER_PRACTICE_SHARE_CONSENT_TYPE,
      status: "granted",
      grantedAt: now,
      grantedByUserId: patientUserId,
      version: INTERPRETER_PRACTICE_SHARE_CONSENT_VERSION,
      metadataJson: input.inviteId
        ? { inviteId: String(input.inviteId).slice(0, 32) }
        : undefined,
    },
  });

  auditInterpreterPracticeShare({
    req: input.req,
    userId: patientUserId,
    patientUserId,
    practiceProfileId,
    action: "interpreter_practice_share_consent_granted",
    entityId: row.id,
    result: "ok",
    metadata: { inviteId: input.inviteId || undefined },
  });

  return row;
}

/**
 * @param {string} consentRecordId
 * @param {string} patientUserId
 * @param {import('express').Request} [req]
 */
export async function revokeInterpreterPracticeShareConsent(
  consentRecordId,
  patientUserId,
  req,
) {
  const id = String(consentRecordId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!id || !uid) throw new Error("validation_required");

  const row = await prisma.consentRecord.findFirst({
    where: {
      id,
      patientUserId: uid,
      consentType: INTERPRETER_PRACTICE_SHARE_CONSENT_TYPE,
      status: "granted",
    },
  });
  if (!row) return null;

  const now = new Date();
  const updated = await prisma.consentRecord.update({
    where: { id },
    data: {
      status: "revoked",
      revokedAt: now,
      revokedByUserId: uid,
    },
  });

  auditInterpreterPracticeShare({
    req,
    userId: uid,
    patientUserId: uid,
    practiceProfileId: row.practiceProfileId || undefined,
    action: "interpreter_practice_share_consent_revoked",
    entityId: row.id,
    result: "ok",
  });

  return updated;
}
