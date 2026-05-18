import {
  buildFhirDocumentReferenceFromLocal,
  buildFhirMedicationFromLocal,
  buildFhirPatientFromLocal,
} from "./fhir/fhirAdapter.js";
import { buildBasicAck, parseHl7V2Message } from "./hl7v2/hl7V2Adapter.js";
import { isPvsSandboxEnabled } from "../../config/featureFlags.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageIntegrations } from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";

export const SAMPLE_HL7_ADT = [
  "MSH|^~\\&|SANDBOX|PVS|MedScoutX|TEST|20260101120000||ADT^A01|MSG00001|P|2.5",
  "PID|1||SANDBOX-001^^^PVS^MR||Mustermann^Max||19800101|M",
].join("\r");

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 */
export async function getSandboxOverview(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");
  if (!isPvsSandboxEnabled()) throw new Error("sandbox_disabled");

  return {
    sandbox: true,
    noRealDataTransmitted: true,
    samples: {
      fhirPatient: buildFhirPatientFromLocal({
        displayName: "Sandbox Patient",
        linkId: "sandbox-link-001",
        locale: "de",
      }),
      fhirDocument: buildFhirDocumentReferenceFromLocal({
        documentId: "sandbox-doc-001",
        title: "Sandbox document metadata",
        createdAt: new Date().toISOString(),
      }),
      fhirMedication: buildFhirMedicationFromLocal({
        planId: "sandbox-plan-001",
        status: "active",
        title: "Sandbox medication plan (metadata)",
      }),
      hl7Message: SAMPLE_HL7_ADT,
      hl7Ack: buildBasicAck({ messageControlId: "MSG00001" }),
    },
  };
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {string} hl7Raw
 * @param {{ req?: import('express').Request }} ctx
 */
export async function runSandboxHl7Parse(actorUserId, practiceId, hl7Raw, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");
  if (!isPvsSandboxEnabled()) throw new Error("sandbox_disabled");

  const parsed = parseHl7V2Message(hl7Raw || SAMPLE_HL7_ADT);

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "integration_hl7_parse_test",
    practiceProfileId: practiceId,
    metadata: {
      ok: parsed.ok,
      messageType: parsed.ok ? parsed.messageType?.message : null,
    },
  }).catch(() => {});

  return {
    parsed,
    ackPreview: buildBasicAck({
      messageControlId: parsed.ok ? parsed.messageControlId : "1",
    }),
  };
}
