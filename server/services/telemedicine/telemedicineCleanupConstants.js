/** Telemedicine session cleanup thresholds (organizational / technical only). */

export const TELEMEDICINE_WAITING_MAX_MS = 2 * 60 * 60 * 1000;
export const TELEMEDICINE_PLANNED_GRACE_MS = 30 * 60 * 1000;
/** Active sessions beyond this are noted in audit only — not auto-terminated. */
export const TELEMEDICINE_ACTIVE_REVIEW_MS = 4 * 60 * 60 * 1000;

export const TELEMEDICINE_OPEN_STATUSES = Object.freeze([
  "planned",
  "waiting",
  "active",
]);

export const TELEMEDICINE_TERMINAL_STATUSES = Object.freeze([
  "completed",
  "cancelled",
  "failed",
]);

export const PARTICIPANT_OPEN_STATUSES = Object.freeze([
  "invited",
  "waiting",
  "joined",
]);

export function telemedicineCleanupBatchSize() {
  const n = Number(process.env.TELEMEDICINE_CLEANUP_BATCH_SIZE);
  return Number.isFinite(n) && n > 0 ? Math.min(200, Math.floor(n)) : 50;
}
