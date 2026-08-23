/**
 * What a practice-internal note or reminder may contain.
 *
 * Pure validation: no database, no I/O, no clock beyond the one the caller
 * passes in. The system never interprets the text — a reminder saying "call
 * back" is a string and a date, not a clinical instruction.
 */

export const MAX_NOTE_BODY_CHARS = 4000;
export const MAX_REMINDER_TITLE_CHARS = 200;

/** How far ahead a reminder may be set. Ten years is a bound, not a policy. */
export const MAX_REMINDER_DAYS_AHEAD = 3650;

export const INTERNAL_WORK_ERRORS = Object.freeze({
  BODY_REQUIRED: "body_required",
  BODY_TOO_LONG: "body_too_long",
  TITLE_REQUIRED: "title_required",
  TITLE_TOO_LONG: "title_too_long",
  DUE_AT_REQUIRED: "due_at_required",
  DUE_AT_INVALID: "due_at_invalid",
  DUE_AT_OUT_OF_RANGE: "due_at_out_of_range",
  ASSIGNEE_NOT_IN_PRACTICE: "assignee_not_in_practice",
  NOT_FOUND: "not_found",
  ALREADY_COMPLETED: "already_completed",
});

export class InternalWorkError extends Error {
  /** @param {string} code one of INTERNAL_WORK_ERRORS @param {object} [details] never a body or title */
  constructor(code, details = {}) {
    super(code);
    this.name = "InternalWorkError";
    this.code = code;
    this.details = details;
  }
}

/**
 * @param {unknown} value
 * @returns {string} the trimmed body
 */
export function assertUsableNoteBody(value) {
  const raw = value == null ? "" : String(value);
  // Length before trim: whitespace padding must not get past the ceiling.
  if (raw.length > MAX_NOTE_BODY_CHARS) {
    throw new InternalWorkError(INTERNAL_WORK_ERRORS.BODY_TOO_LONG, {
      chars: raw.length,
      max: MAX_NOTE_BODY_CHARS,
    });
  }
  const body = raw.trim();
  if (!body) throw new InternalWorkError(INTERNAL_WORK_ERRORS.BODY_REQUIRED);
  return body;
}

/**
 * @param {unknown} value
 * @returns {string} the trimmed title
 */
export function assertUsableReminderTitle(value) {
  const raw = value == null ? "" : String(value);
  if (raw.length > MAX_REMINDER_TITLE_CHARS) {
    throw new InternalWorkError(INTERNAL_WORK_ERRORS.TITLE_TOO_LONG, {
      chars: raw.length,
      max: MAX_REMINDER_TITLE_CHARS,
    });
  }
  const title = raw.trim();
  if (!title) throw new InternalWorkError(INTERNAL_WORK_ERRORS.TITLE_REQUIRED);
  return title;
}

/**
 * A due date the server is willing to store.
 *
 * Past dates are ALLOWED. A practice writing "should have called on Monday"
 * while catching up on Tuesday is ordinary work, and the product has no
 * existing rule against backdating a marker. What is rejected is a value that
 * is not a date, or one so far out that it is a typo rather than a plan.
 *
 * @param {unknown} value ISO string or Date
 * @param {Date} [now] injected clock — the server's, never the client's
 * @returns {Date}
 */
export function assertUsableDueAt(value, now = new Date()) {
  if (value == null || value === "") {
    throw new InternalWorkError(INTERNAL_WORK_ERRORS.DUE_AT_REQUIRED);
  }
  const due = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(due.getTime())) {
    throw new InternalWorkError(INTERNAL_WORK_ERRORS.DUE_AT_INVALID);
  }
  const daysAhead = (due.getTime() - now.getTime()) / 86_400_000;
  if (daysAhead > MAX_REMINDER_DAYS_AHEAD) {
    throw new InternalWorkError(INTERNAL_WORK_ERRORS.DUE_AT_OUT_OF_RANGE, {
      maxDaysAhead: MAX_REMINDER_DAYS_AHEAD,
    });
  }
  return due;
}
