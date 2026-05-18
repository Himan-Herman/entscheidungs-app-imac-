/**
 * FHIR adapter — structural mapping only; no medical interpretation.
 * Default profile: R4-compatible resource shapes.
 */

const FHIR_RESOURCE_TYPES = new Set([
  "Patient",
  "Practitioner",
  "Organization",
  "DocumentReference",
  "MedicationStatement",
  "MedicationRequest",
  "Communication",
  "Consent",
  "AuditEvent",
]);

/**
 * @param {string} version
 */
export function fhirMeta(version = "R4") {
  return {
    profile: [`http://hl7.org/fhir/StructureDefinition/${version === "R5" ? "Patient" : "Patient"}`],
  };
}

/**
 * @param {{ practiceName?: string, displayName?: string, linkId?: string, locale?: string }} local
 * @param {{ fhirVersion?: string }} opts
 */
export function buildFhirPatientFromLocal(local, opts = {}) {
  const version = opts.fhirVersion || "R4";
  const nameText =
    String(local.displayName || local.practiceName || "Patient").trim().slice(0, 200) || "Patient";
  const resource = {
    resourceType: "Patient",
    meta: fhirMeta(version),
    identifier: local.linkId
      ? [{ system: "urn:medscoutx:practice-patient-link", value: String(local.linkId).slice(0, 64) }]
      : undefined,
    name: [{ use: "usual", text: nameText }],
    language: local.locale ? String(local.locale).slice(0, 8) : undefined,
  };
  return resource;
}

/**
 * @param {{ documentId?: string, title?: string, createdAt?: string, status?: string }} local
 */
export function buildFhirDocumentReferenceFromLocal(local, opts = {}) {
  const version = opts.fhirVersion || "R4";
  return {
    resourceType: "DocumentReference",
    meta: fhirMeta(version),
    status: "current",
    identifier: local.documentId
      ? [{ system: "urn:medscoutx:practice-document", value: String(local.documentId).slice(0, 64) }]
      : undefined,
    description: String(local.title || "Document").slice(0, 500),
    date: local.createdAt || new Date().toISOString(),
    content: [
      {
        attachment: {
          contentType: "application/pdf",
          title: "Metadata only — content not embedded in integration preview",
        },
      },
    ],
  };
}

/**
 * @param {{ planId?: string, status?: string, title?: string }} local
 */
export function buildFhirMedicationFromLocal(local, opts = {}) {
  const version = opts.fhirVersion || "R4";
  const useRequest = opts.useMedicationRequest === true;
  const base = {
    meta: fhirMeta(version),
    identifier: local.planId
      ? [{ system: "urn:medscoutx:medication-plan", value: String(local.planId).slice(0, 64) }]
      : undefined,
    status: String(local.status || "unknown").slice(0, 32),
  };
  if (useRequest) {
    return {
      resourceType: "MedicationRequest",
      ...base,
      intent: "plan",
      subject: { display: "Linked patient (metadata)" },
    };
  }
  return {
    resourceType: "MedicationStatement",
    ...base,
    medicationCodeableConcept: local.title
      ? { text: String(local.title).slice(0, 200) }
      : undefined,
  };
}

/**
 * @param {unknown} resource
 */
export function parseFhirPatient(resource) {
  if (!resource || typeof resource !== "object") return { ok: false, error: "invalid_resource" };
  const r = /** @type {Record<string, unknown>} */ (resource);
  if (r.resourceType !== "Patient") return { ok: false, error: "wrong_resource_type" };
  const names = Array.isArray(r.name) ? r.name : [];
  const first = names[0] && typeof names[0] === "object" ? names[0] : {};
  return {
    ok: true,
    metadata: {
      displayName: String(/** @type {Record<string, unknown>} */ (first).text || "").slice(0, 200),
      identifiers: Array.isArray(r.identifier)
        ? r.identifier
            .slice(0, 5)
            .map((id) =>
              id && typeof id === "object"
                ? {
                    system: String(/** @type {Record<string, unknown>} */ (id).system || "").slice(0, 120),
                    value: String(/** @type {Record<string, unknown>} */ (id).value || "").slice(0, 64),
                  }
                : null,
            )
            .filter(Boolean)
        : [],
    },
  };
}

/**
 * @param {unknown} resource
 */
export function parseFhirDocumentReference(resource) {
  if (!resource || typeof resource !== "object") return { ok: false, error: "invalid_resource" };
  const r = /** @type {Record<string, unknown>} */ (resource);
  if (r.resourceType !== "DocumentReference") return { ok: false, error: "wrong_resource_type" };
  return {
    ok: true,
    metadata: {
      description: String(r.description || "").slice(0, 500),
      date: r.date ? String(r.date).slice(0, 40) : null,
      status: String(r.status || "").slice(0, 32),
    },
  };
}

/**
 * Basic structural validation — not a full FHIR validator.
 * @param {unknown} resource
 */
export function validateFhirResourceBasic(resource) {
  if (!resource || typeof resource !== "object") {
    return { valid: false, issues: ["resource_must_be_object"] };
  }
  const r = /** @type {Record<string, unknown>} */ (resource);
  const type = String(r.resourceType || "");
  const issues = [];
  if (!type) issues.push("missing_resourceType");
  else if (!FHIR_RESOURCE_TYPES.has(type)) issues.push("unsupported_resourceType");
  if (JSON.stringify(resource).length > 512 * 1024) issues.push("resource_too_large");
  return { valid: issues.length === 0, issues, resourceType: type || null };
}
