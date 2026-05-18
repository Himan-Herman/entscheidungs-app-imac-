/**
 * Unified lifecycle status helpers (archive / soft-delete / revoke).
 * No clinical content — metadata filters only.
 */

export const RESOURCE_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
  REVOKED: "revoked",
  DELETED: "deleted",
};

/**
 * @param {import('express').Request | Record<string, unknown>} reqOrQuery
 */
export function parseIncludeArchived(reqOrQuery) {
  const q = reqOrQuery?.query ?? reqOrQuery;
  const v = String(q?.includeArchived ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
}

/**
 * PracticeDocument / MedicationPlan list filter.
 * @param {{ includeArchived?: boolean }} opts
 */
export function practiceResourceStatusWhere(opts = {}) {
  if (opts.includeArchived) {
    return { status: { not: RESOURCE_STATUS.DELETED } };
  }
  return { status: { notIn: [RESOURCE_STATUS.DELETED, RESOURCE_STATUS.ARCHIVED] } };
}

/**
 * @param {string | null | undefined} status
 */
export function isDeletedStatus(status) {
  return String(status || "") === RESOURCE_STATUS.DELETED;
}

/**
 * @param {string | null | undefined} status
 */
export function isArchivedStatus(status) {
  return String(status || "") === RESOURCE_STATUS.ARCHIVED;
}

/**
 * @param {string | null | undefined} status
 * @param {{ allowArchivedRead?: boolean }} [opts]
 */
export function assertResourceReadable(status, opts = {}) {
  if (isDeletedStatus(status)) {
    const err = new Error("resource_deleted");
    err.code = "resource_deleted";
    throw err;
  }
  if (isArchivedStatus(status) && !opts.allowArchivedRead) {
    const err = new Error("resource_archived");
    err.code = "resource_archived";
    throw err;
  }
}

/**
 * @param {string | null | undefined} status
 */
export function assertResourceWritable(status) {
  assertResourceReadable(status);
  if (isArchivedStatus(status)) {
    const err = new Error("resource_archived");
    err.code = "resource_archived";
    throw err;
  }
}
