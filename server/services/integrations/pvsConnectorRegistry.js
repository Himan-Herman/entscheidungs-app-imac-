/**
 * Modular PVS connector registry — no vendor credentials; sandbox/test only in MVP.
 */

import {
  isFhirIntegrationEnabled,
  isHl7v2IntegrationEnabled,
  isPvsProductionEnabled,
  isPvsSandboxEnabled,
} from "../../config/featureFlags.js";
import { buildBasicAck, parseHl7V2Message } from "./hl7v2/hl7V2Adapter.js";
import {
  buildFhirDocumentReferenceFromLocal,
  buildFhirMedicationFromLocal,
  buildFhirPatientFromLocal,
  validateFhirResourceBasic,
} from "./fhir/fhirAdapter.js";

/** @typedef {{ name: string, type: string, capabilities: string[], requiredConfig: string[], status: string }} ConnectorDescriptor */

/** @type {Record<string, ConnectorDescriptor & { testConnection: Function, import: Function, export: Function }>} */
const CONNECTORS = {
  fhir_generic: {
    name: "FHIR (generic)",
    type: "fhir",
    status: "sandbox_ready",
    capabilities: ["metadata_export", "fhir_preview", "fhir_validate"],
    requiredConfig: ["baseUrl", "fhirVersion"],
    async testConnection() {
      if (!isFhirIntegrationEnabled() && !isPvsSandboxEnabled()) {
        return { ok: false, error: "fhir_disabled" };
      }
      return { ok: true, mode: isPvsProductionEnabled() ? "production_capable" : "sandbox_only" };
    },
    async import() {
      return { ok: false, error: "auto_import_disabled_mvp" };
    },
    async export(ctx) {
      return {
        ok: true,
        sandbox: !isPvsProductionEnabled(),
        resources: [
          buildFhirPatientFromLocal(ctx.samplePatient || {}, { fhirVersion: ctx.fhirVersion }),
        ],
      };
    },
  },
  hl7v2_generic: {
    name: "HL7 v2 (generic)",
    type: "hl7v2",
    status: "sandbox_ready",
    capabilities: ["hl7_parse", "hl7_ack_preview"],
    requiredConfig: [],
    async testConnection() {
      if (!isHl7v2IntegrationEnabled() && !isPvsSandboxEnabled()) {
        return { ok: false, error: "hl7_disabled" };
      }
      return { ok: true, mode: "parse_only" };
    },
    async import(payload) {
      const parsed = parseHl7V2Message(payload?.message || "");
      return { ok: parsed.ok, parsed: parsed.ok ? { messageType: parsed.messageType } : null, error: parsed.error };
    },
    async export() {
      return { ok: false, error: "hl7_export_disabled_mvp" };
    },
  },
  pvs_sandbox: {
    name: "PVS Sandbox",
    type: "pvs",
    status: "sandbox",
    capabilities: ["sandbox_samples", "mapping_preview"],
    requiredConfig: [],
    async testConnection() {
      if (!isPvsSandboxEnabled()) return { ok: false, error: "sandbox_disabled" };
      return { ok: true, message: "sandbox_no_outbound" };
    },
    async import() {
      return { ok: true, sandbox: true, imported: 0 };
    },
    async export(ctx) {
      return {
        ok: true,
        sandbox: true,
        patient: buildFhirPatientFromLocal(ctx.samplePatient || {}),
        document: buildFhirDocumentReferenceFromLocal(ctx.sampleDocument || {}),
        medication: buildFhirMedicationFromLocal(ctx.sampleMedication || {}),
        hl7Ack: buildBasicAck({ messageControlId: "SANDBOX-1" }),
      };
    },
  },
  custom_placeholder: {
    name: "Custom (placeholder)",
    type: "custom",
    status: "disabled",
    capabilities: [],
    requiredConfig: ["vendorName"],
    async testConnection() {
      return { ok: false, error: "connector_not_configured" };
    },
    async import() {
      return { ok: false, error: "connector_not_configured" };
    },
    async export() {
      return { ok: false, error: "connector_not_configured" };
    },
  },
};

/**
 * @param {string} key
 */
export function getConnector(key) {
  return CONNECTORS[key] || CONNECTORS.custom_placeholder;
}

export function listConnectorDescriptors() {
  return Object.entries(CONNECTORS).map(([key, c]) => ({
    key,
    name: c.name,
    type: c.type,
    status: c.status,
    capabilities: c.capabilities,
    requiredConfig: c.requiredConfig,
  }));
}

export function validateConnectorResource(resource) {
  return validateFhirResourceBasic(resource);
}
