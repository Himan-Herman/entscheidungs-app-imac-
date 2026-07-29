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
 *   lockLink?: boolean,
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

  let link;
  if (input.lockLink && typeof client.$queryRaw === "function") {
    // Inside a write transaction: take a shared row lock. Serializable alone
    // does NOT reliably abort this particular pattern — one transaction reads
    // the link while another updates it, which is a single rw-dependency and
    // not the "dangerous structure" SSI aborts on. FOR SHARE makes a concurrent
    // revocation wait until this write has committed, which is the behaviour we
    // actually need. Verified in the sandbox race test.
    const rows = await client.$queryRaw`
      SELECT "id", "status" FROM "PracticePatientLink"
      WHERE "id" = ${requested} AND "patientUserId" = ${patientUserId}
      FOR SHARE
    `;
    link = Array.isArray(rows) ? rows[0] ?? null : null;
  } else {
    link = await client.practicePatientLink.findFirst({
      // Ownership is part of the lookup, so a foreign link is indistinguishable
      // from a missing one.
      where: { id: requested, patientUserId },
      select: { id: true, status: true },
    });
  }

  if (!link) throw new InvalidContextError("link_not_found");
  if (!WRITABLE_LINK_STATES.has(link.status)) throw new InvalidContextError("link_not_active");

  return { dataScope: "practice_contextual", contextPracticePatientLinkId: link.id };
}


/* ------------------------------------------------------------ atomic write */

/**
 * PostgreSQL serialization failure (40001) and deadlock (40P01). Prisma
 * surfaces both as P2034 "write conflict or deadlock"; the raw SQLSTATE can
 * also appear in the message of an unknown-request error.
 */
function isSerializationConflict(err) {
  if (!err) return false;
  if (err.code === "P2034") return true;
  const text = `${err.code ?? ""} ${err.message ?? ""}`;
  return /\b40001\b|\b40P01\b|could not serialize|deadlock detected/i.test(text);
}

/** Raised when the conflict persisted after every allowed attempt. */
export class ContextWriteConflictError extends Error {
  constructor() {
    super("context_write_conflict");
    this.status = 409;
  }
}

/** A retry beyond this is pointless and would only prolong the request. */
export const MAX_WRITE_ATTEMPTS = 3;

/**
 * Creates a patient-owned record with its context resolved INSIDE the same
 * transaction that writes it.
 *
 * Previously the link was validated in one statement and the record written in
 * another, so a link revoked in between still produced a contextual record.
 * Here the link is re-read and row-locked within the transaction, so a
 * concurrent revocation must wait for this write to finish and can no longer
 * slip in front of it.
 *
 * Retries cover serialization conflicts only. A validation, ownership or
 * permission failure is never retried, and a failed attempt writes nothing, so
 * a retry cannot produce a duplicate.
 *
 * @param {{
 *   patientUserId: string,
 *   requestedPracticePatientLinkId?: string | null,
 *   createRecord: (tx: object, context: object) => Promise<object>,
 *   prismaClient?: object,
 *   maxAttempts?: number,
 * }} input
 */
export async function createPatientDataWithValidatedContext(input) {
  const client = input.prismaClient ?? defaultClient;
  const maxAttempts = input.maxAttempts ?? MAX_WRITE_ATTEMPTS;
  let lastConflict = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await client.$transaction(
        async (tx) => {
          const context = await resolvePatientDataContextForWrite({
            patientUserId: input.patientUserId,
            requestedPracticePatientLinkId: input.requestedPracticePatientLinkId,
            prismaClient: tx,
            lockLink: true,
          });
          return input.createRecord(tx, context);
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      // Only a serialization conflict may be retried. Everything else — an
      // invalid context, a foreign link, an unknown database error — is final.
      if (!isSerializationConflict(err)) throw err;
      lastConflict = err;
    }
  }
  throw new ContextWriteConflictError(lastConflict);
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
  if (err instanceof ContextWriteConflictError) {
    // No internal database code and no link id reaches the client.
    return { status: 409, body: { ok: false, error: "context_write_conflict" } };
  }
  return null;
}

/**
 * The Prisma selection the patient routes use to resolve an archived context.
 *
 * Deliberately narrow: only what the patient is shown. The archive's own id,
 * the original link id, the original practice id, the patient id and the
 * archive reason are internal and are never loaded, so they cannot be
 * serialised by accident.
 */
export const ARCHIVED_CONTEXT_SELECT = Object.freeze({
  select: {
    practiceDisplayNameSnapshot: true,
    practiceSpecialtySnapshot: true,
    archivedAt: true,
  },
});

/** The three states a patient's record can be in, plus a defensive fourth. */
export const PRACTICE_CONTEXT_STATE = Object.freeze({
  NONE: "none",
  ACTIVE: "active",
  ARCHIVED: "archived",
  UNAVAILABLE: "unavailable",
});

/**
 * Provenance fields for a patient-facing response.
 *
 * One shape for all four models: the patient should not have to learn a
 * different vocabulary per data type.
 *
 *   patient_global      → none      the patient's own data
 *   contextual + link   → active    a care relationship that still exists
 *   contextual + archive→ archived  a practice that was deleted
 *   anything else       → unavailable
 *
 * The last case should be unreachable — the database CHECK permits only the
 * three shapes above — but an unclassifiable record is reported as such rather
 * than being presented as the patient's own data, which is a claim we could
 * not support.
 *
 * dataScope is meaningful to the patient, and the link id is theirs, so both
 * may be returned. The ARCHIVE's ids are not theirs to see: they name rows that
 * no longer exist and would only expose which practice profile was deleted.
 *
 * @param {{
 *   dataScope?: string|null,
 *   contextPracticePatientLinkId?: string|null,
 *   archivedPracticeContextId?: string|null,
 *   archivedPracticeContext?: {
 *     practiceDisplayNameSnapshot?: string|null,
 *     practiceSpecialtySnapshot?: string|null,
 *     archivedAt?: Date|string|null,
 *   } | null,
 * }} row
 */
export function provenanceJson(row) {
  const dataScope = row?.dataScope ?? null;
  const linkId = row?.contextPracticePatientLinkId ?? null;
  const archive = row?.archivedPracticeContext ?? null;
  const hasArchive = Boolean(row?.archivedPracticeContextId || archive);

  if (dataScope === "patient_global" && !linkId && !hasArchive) {
    return {
      dataScope,
      practiceContextState: PRACTICE_CONTEXT_STATE.NONE,
      contextPracticePatientLinkId: null,
      archivedPractice: null,
    };
  }

  if (dataScope === "practice_contextual" && linkId && !hasArchive) {
    return {
      dataScope,
      practiceContextState: PRACTICE_CONTEXT_STATE.ACTIVE,
      contextPracticePatientLinkId: linkId,
      archivedPractice: null,
    };
  }

  if (dataScope === "practice_contextual" && !linkId && hasArchive) {
    return {
      dataScope,
      practiceContextState: PRACTICE_CONTEXT_STATE.ARCHIVED,
      // A record with an archived context has no live link, by invariant.
      contextPracticePatientLinkId: null,
      // Null when the relation was not selected — the state is still archived,
      // and the UI says "former practice context" without a name.
      archivedPractice: archive
        ? {
            displayName: archive.practiceDisplayNameSnapshot ?? null,
            specialty: archive.practiceSpecialtySnapshot ?? null,
            archivedAt: archive.archivedAt ?? null,
          }
        : null,
    };
  }

  return {
    dataScope,
    practiceContextState: PRACTICE_CONTEXT_STATE.UNAVAILABLE,
    contextPracticePatientLinkId: null,
    archivedPractice: null,
  };
}
