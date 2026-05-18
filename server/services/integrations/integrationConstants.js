/** Integration layer constants — organizational only. */

export const CONNECTION_TYPES = new Set(["fhir", "hl7v2", "pvs", "custom"]);
export const CONNECTION_STATUSES = new Set([
  "disabled",
  "sandbox",
  "active",
  "error",
  "revoked",
]);
export const AUTH_TYPES = new Set(["none", "api_key", "oauth2", "basic", "mTLS"]);
export const FHIR_VERSIONS = new Set(["R4", "R4B", "R5"]);
export const JOB_TYPES = new Set(["import", "export", "sync", "test"]);
export const JOB_DIRECTIONS = new Set(["inbound", "outbound"]);
export const JOB_STATUSES = new Set([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const MAX_FHIR_PREVIEW_BYTES = 256 * 1024;
export const MAX_HL7_PARSE_BYTES = 64 * 1024;

export const DEFAULT_MAPPINGS = [
  {
    sourceType: "local_patient_link",
    targetType: "fhir:Patient",
    mappingJson: {
      fields: [
        { local: "patientDisplayName", fhir: "name[0].text" },
        { local: "linkId", fhir: "identifier[0].value" },
      ],
    },
    version: "1",
  },
  {
    sourceType: "local_document",
    targetType: "fhir:DocumentReference",
    mappingJson: {
      fields: [
        { local: "title", fhir: "description" },
        { local: "documentId", fhir: "identifier[0].value" },
        { local: "createdAt", fhir: "date" },
      ],
    },
    version: "1",
  },
  {
    sourceType: "local_medication_plan",
    targetType: "fhir:MedicationStatement",
    mappingJson: {
      fields: [
        { local: "planId", fhir: "identifier[0].value" },
        { local: "status", fhir: "status" },
      ],
    },
    version: "1",
  },
  {
    sourceType: "hl7v2:ADT",
    targetType: "local_patient_metadata",
    mappingJson: {
      segments: ["PID"],
      fields: ["PID-3", "PID-5", "PID-7"],
    },
    version: "1",
  },
];
