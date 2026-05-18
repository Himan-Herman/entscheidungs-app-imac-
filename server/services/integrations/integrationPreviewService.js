import {
  buildFhirDocumentReferenceFromLocal,
  buildFhirMedicationFromLocal,
  buildFhirPatientFromLocal,
  validateFhirResourceBasic,
} from "./fhir/fhirAdapter.js";
import { buildBasicAck, parseHl7V2Message } from "./hl7v2/hl7V2Adapter.js";
import {
  isFhirIntegrationEnabled,
  isHl7v2IntegrationEnabled,
  isPvsSandboxEnabled,
} from "../../config/featureFlags.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageIntegrations } from "../../utils/practicePermissions.js";
import { writeAuditLog } from "../auditLogService.js";
import { MAX_FHIR_PREVIEW_BYTES, MAX_HL7_PARSE_BYTES } from "./integrationConstants.js";

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {Record<string, unknown>} body
 * @param {{ req?: import('express').Request }} ctx
 */
export async function fhirPreview(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");
  if (!isFhirIntegrationEnabled() && !isPvsSandboxEnabled()) {
    throw new Error("fhir_disabled");
  }

  const resourceType = String(body.resourceType || "Patient").trim();
  const fhirVersion = String(body.fhirVersion || "R4").trim();
  let resource;
  if (resourceType === "DocumentReference") {
    resource = buildFhirDocumentReferenceFromLocal(body.local || {}, { fhirVersion });
  } else if (resourceType === "MedicationStatement" || resourceType === "MedicationRequest") {
    resource = buildFhirMedicationFromLocal(body.local || {}, {
      fhirVersion,
      useMedicationRequest: resourceType === "MedicationRequest",
    });
  } else {
    resource = buildFhirPatientFromLocal(body.local || {}, { fhirVersion });
  }

  const size = JSON.stringify(resource).length;
  if (size > MAX_FHIR_PREVIEW_BYTES) throw new Error("payload_too_large");

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "integration_fhir_preview",
    practiceProfileId: practiceId,
    metadata: { resourceType: resource.resourceType, bytes: size },
  }).catch(() => {});

  return { resource, sandbox: !isFhirIntegrationEnabled() || isPvsSandboxEnabled() };
}

export async function fhirValidate(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");
  if (!isFhirIntegrationEnabled() && !isPvsSandboxEnabled()) throw new Error("fhir_disabled");

  const raw = body.resource;
  const size = JSON.stringify(raw || {}).length;
  if (size > MAX_FHIR_PREVIEW_BYTES) throw new Error("payload_too_large");

  return validateFhirResourceBasic(raw);
}

export async function hl7Parse(actorUserId, practiceId, body, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");
  if (!isHl7v2IntegrationEnabled() && !isPvsSandboxEnabled()) throw new Error("hl7_disabled");

  const message = String(body.message || "");
  if (message.length > MAX_HL7_PARSE_BYTES) throw new Error("payload_too_large");

  const parsed = parseHl7V2Message(message);

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "integration_hl7_parse_test",
    practiceProfileId: practiceId,
    metadata: { ok: parsed.ok, message: parsed.ok ? parsed.messageType?.message : null },
  }).catch(() => {});

  return {
    parsed,
    ackPreview: buildBasicAck({
      messageControlId: parsed.ok ? parsed.messageControlId : "1",
    }),
  };
}

export async function hl7AckPreview(actorUserId, practiceId, body) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");
  if (!isHl7v2IntegrationEnabled() && !isPvsSandboxEnabled()) throw new Error("hl7_disabled");

  return {
    ack: buildBasicAck({
      messageControlId: String(body.messageControlId || "1").slice(0, 64),
      ackCode: String(body.ackCode || "AA").slice(0, 2),
    }),
  };
}
