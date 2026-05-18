/** Organizational enums for practice account — no clinical semantics. */

export const ORGANIZATION_TYPES = new Set([
  "single_practice",
  "group_practice",
  "mvz",
  "clinic",
  "outpatient",
  "other",
]);

export const INSURANCE_TRI_STATE = new Set(["yes", "no", "unknown"]);

export const ASSIGNMENT_STATUSES = new Set([
  "unassigned",
  "assigned",
  "forwarded",
  "closed",
]);

export const ASSIGNMENT_TYPES = new Set(["doctor", "secretary", "assistant", "team"]);

export const MEMBER_POSITIONS = new Set([
  "physician",
  "specialist",
  "resident",
  "secretary",
  "medical_assistant",
  "practice_manager",
  "administration",
  "other",
]);

export const INBOX_WORKFLOW_FILTERS = new Set([
  "all",
  "assigned_to_me",
  "unassigned",
  "secretary",
  "doctors",
  "by_patient",
]);

/** Maps UI workflow labels to stored inbox status values. */
export const INBOX_WORKFLOW_STATUS_MAP = {
  new: "new",
  in_progress: "read",
  forwarded: "read",
  done: "done",
  archived: "archived",
};
