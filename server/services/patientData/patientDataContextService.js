/**
 * Resolves the care-relationship context for a patient-owned medical write.
 *
 * The four patient-owned models (vitals, vaccinations, allergies, diagnoses)
 * are either globally owned by the patient or were recorded inside one concrete
 * care relationship. That classification is a SERVER decision: the only thing a
 * client may say is "this belongs to link X", and even that is accepted solely
 * after the link has been loaded and proven to belong to the authenticated
 * patient.
 *
 * Nothing else from the request influences the outcome — not a practiceId, not
 * a practiceProfileId, not a dataScope, not a user id. The practice is never
 * named by the client; it is implied by the link and not stored on these models
 * at all.
 */

import { prisma as defaultClient } from "../../lib/prisma.js";

/** The only request field a client may use to express a context. */
export const CONTEXT_INPUT_FIELD = "practicePatientLinkId";

/**
 * Fields that describe provenance. A client may never set them, neither on
 * create nor on update — see assertNoProvenanceOverride.
 */
export const PROVENANCE_FIELDS = Object.freeze([
  "dataScope",
  "contextPracticePatientLinkId",
  "contextPracticePatientLink",
  "practiceProfileId",
  "practiceId",
  "originType",
  "userId",
  "patientUserId",
]);

/** Link states a patient may still file new records under. */
const WRITABLE_LINK_STATES = new Set(["active"]);

/** Thrown when the client sent a field it is not allowed to control. */
export class UnsupportedFieldError extends Error {
  constructor(field) {
    super("unsupported_field");
    this.field = field;
    this.status = 400;
  }
}

/** Thrown when a context was requested but cannot be used. */
export class InvalidContextError extends Error {
  /** @param {"link_not_found"|"link_not_active"} code */
  constructor(code) {
    super(code);
    // A link that does not exist and a link belonging to someone else are the
    // same answer, so a patient cannot probe for other people's links.
    this.status = code === "link_not_found" ? 404 : 409;
  }
}

/**
 * Rejects any request body that tries to set provenance directly.
 * Explicit allowlist semantics: unknown provenance-shaped keys are refused
 * rather than silently dropped, so a client cannot believe it set them.
 *
 * @param {unknown} body
 */
export function assertNoProvenanceOverride(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  for (const field of PROVENANCE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      throw new UnsupportedFieldError(field);
    }
  }
}

/**
 * Rejects any attempt to change provenance through an ordinary update.
 *
 * Stricter than assertNoProvenanceOverride: on update even the legitimate
 * CREATE input field is refused, because naming a link on an existing record
 * would move it between care relationships. Provenance is set once.
 *
 * @param {unknown} body
 */
export function assertNoContextChange(body) {
  assertNoProvenanceOverride(body);
  if (
    body && typeof body === "object" && !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, CONTEXT_INPUT_FIELD)
  ) {
    throw new UnsupportedFieldError(CONTEXT_INPUT_FIELD);
  }
}

/**
 * Rejects a body carrying keys outside the allowlist.
 *
 * @param {unknown} body
 * @param {string[]} allowed
 */
export function assertAllowedFields(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  const permitted = new Set(allowed);
  for (const key of Object.keys(body)) {
    if (!permitted.has(key)) throw new UnsupportedFieldError(key);
  }
}

/**
 * Determines dataScope and context for a new patient-owned record.
 *
 * Without a link the record is the patient's own; with one, the link is loaded
 * server-side and must belong to the authenticated patient and be active.
 *
 * @param {{
 *   patientUserId: string,
 *   requestedPracticePatientLinkId?: string | null,
 *   prismaClient?: object,
 * }} input
 * @returns {Promise<{ dataScope: "patient_global"|"practice_contextual", contextPracticePatientLinkId: string | null }>}
 */
export async function resolvePatientDataContextForWrite(input) {
  const patientUserId = String(input?.patientUserId || "").trim();
  if (!patientUserId) throw new InvalidContextError("link_not_found");

  const requested = String(input?.requestedPracticePatientLinkId || "").trim();
  if (!requested) {
    // Backwards compatible: a client that knows nothing about contexts keeps
    // producing patient-owned records. This is an explicit decision here, not
    // a database default.
    return { dataScope: "patient_global", contextPracticePatientLinkId: null };
  }

  const client = input.prismaClient ?? defaultClient;
  const link = await client.practicePatientLink.findFirst({
    // Ownership is part of the lookup, so a foreign link is indistinguishable
    // from a missing one.
    where: { id: requested, patientUserId },
    select: { id: true, status: true },
  });
  if (!link) throw new InvalidContextError("link_not_found");
  if (!WRITABLE_LINK_STATES.has(link.status)) throw new InvalidContextError("link_not_active");

  return { dataScope: "practice_contextual", contextPracticePatientLinkId: link.id };
}

/**
 * Context for a personal import (wearables, file import).
 *
 * Deliberately always patient-owned: an import carries no server-verified care
 * relationship. A caller that genuinely has one must go through
 * resolvePatientDataContextForWrite instead — there is no implicit fallback.
 */
export function personalImportContext() {
  return { dataScope: "patient_global", contextPracticePatientLinkId: null };
}

/**
 * Maps a context error onto an API response shape.
 * @param {unknown} err
 */
export function contextErrorResponse(err) {
  if (err instanceof UnsupportedFieldError) {
    return { status: 400, body: { ok: false, error: "unsupported_field" } };
  }
  if (err instanceof InvalidContextError) {
    return { status: err.status, body: { ok: false, error: err.message } };
  }
  return null;
}

/**
 * Provenance fields for a patient-facing response.
 *
 * dataScope is meaningful to the patient. The link id is theirs, so it may be
 * returned. No practiceProfileId and no global user id.
 *
 * @param {{ dataScope?: string|null, contextPracticePatientLinkId?: string|null }} row
 */
export function provenanceJson(row) {
  return {
    dataScope: row?.dataScope ?? null,
    contextPracticePatientLinkId: row?.contextPracticePatientLinkId ?? null,
  };
}
