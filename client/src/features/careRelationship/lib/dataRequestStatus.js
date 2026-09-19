/**
 * Data-request status, as people read it.
 *
 * Stored values: submitted, in_review, answered — plus completed and rejected
 * on rows written before "answered" existed. Every closed status reads as
 * "answered": the status only says that the practice has replied, never
 * whether data were deleted, an export delivered or a request granted. The
 * practice's own answer says that.
 */
export const OPEN_STATUSES = new Set(["submitted", "in_review"]);
export const TERMINAL_STATUSES = new Set(["answered", "completed", "rejected"]);

/** Collapse legacy closed values onto "answered". */
export function displayStatus(status) {
  return TERMINAL_STATUSES.has(status) ? "answered" : status;
}

/**
 * @param {string} status
 * @param {{ statusSubmitted: string, statusInReview: string, statusAnswered: string }} t
 */
export function statusLabel(status, t) {
  const s = displayStatus(status);
  if (s === "submitted") return t.statusSubmitted;
  if (s === "in_review") return t.statusInReview;
  if (s === "answered") return t.statusAnswered;
  return s;
}
