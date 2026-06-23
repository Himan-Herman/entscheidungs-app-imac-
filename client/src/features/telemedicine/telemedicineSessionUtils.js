/**
 * Pure, framework-free helpers for telemedicine ("Videosprechstunden") session
 * logic. Extracted from the practice + patient pages so the same rules drive
 * both sides of the Praxis↔Patient connection and can be unit-tested without a
 * JSX/Vite pipeline (run: node --test).
 *
 * No imports, no side effects: every function is deterministic given its inputs.
 * Time-dependent helpers accept an injectable `now` (ms epoch) for testability.
 */

/** All valid session statuses, mirrors the server enum in telemedicineService.js. */
export const SESSION_STATUSES = [
  "planned",
  "waiting",
  "active",
  "completed",
  "cancelled",
  "failed",
];

/** Statuses after which nothing more can happen to a session. */
export const TERMINAL_STATUSES = ["completed", "cancelled", "failed"];

/** Statuses in which a session is still live / actionable. */
export const OPEN_STATUSES = ["planned", "waiting", "active"];

/** Participant statuses that mean the person is present in the waiting room / call. */
export const PRESENT_PARTICIPANT_STATUSES = ["waiting", "joined"];

/** @param {string} status */
export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

/** @param {string} status */
export function isOpenStatus(status) {
  return OPEN_STATUSES.includes(status);
}

/** i18n key for a session status badge, e.g. "status_waiting". */
export function statusLabelKey(status) {
  return `status_${status}`;
}

/** i18n key for a participant status badge, e.g. "participant_joined". */
export function participantLabelKey(status) {
  return `participant_${status}`;
}

function toMs(value) {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * A planned/waiting session whose scheduled end is in the past is "expired":
 * the slot elapsed without the consultation completing.
 * @param {{ status?: string, scheduledEndAt?: string|Date|null }} session
 * @param {number} [now] ms epoch
 */
export function isExpiredSession(session, now = Date.now()) {
  if (!session) return false;
  if (!session.scheduledEndAt) return false;
  if (!["planned", "waiting"].includes(session.status)) return false;
  const endMs = toMs(session.scheduledEndAt);
  return endMs != null && endMs < now;
}

/**
 * Whether the patient may still consent / join. Mirrors the original
 * PatientTelemedicineDetailPage.canJoin gate.
 * @param {{ status?: string, linkRevoked?: boolean, scheduledEndAt?: string|Date|null }} session
 * @param {number} [now] ms epoch
 */
export function canPatientJoin(session, now = Date.now()) {
  return Boolean(
    session &&
      !session.linkRevoked &&
      !isTerminalStatus(session.status) &&
      !isExpiredSession(session, now),
  );
}

/**
 * Patient participants currently present (waiting or joined) — what the doctor
 * sees in the "waiting room" panel.
 * @param {Array<{ role?: string, status?: string }>} [participants]
 */
export function waitingPatients(participants) {
  if (!Array.isArray(participants)) return [];
  return participants.filter(
    (p) => p && p.role === "patient" && PRESENT_PARTICIPANT_STATUSES.includes(p.status),
  );
}

function dayBounds(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

/**
 * Split practice sessions into "today" and "upcoming" buckets for the list page.
 * - today:    has a scheduled start within the current local day.
 * - upcoming: no scheduled start (ad-hoc) OR scheduled start now-or-later.
 * @param {Array<{ scheduledStartAt?: string|Date|null }>} sessions
 * @param {number} [now] ms epoch
 */
export function partitionPracticeSessions(sessions, now = Date.now()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const { startMs, endMs } = dayBounds(now);

  const today = list.filter((s) => {
    const ms = toMs(s?.scheduledStartAt);
    return ms != null && ms >= startMs && ms <= endMs;
  });

  const upcoming = list.filter((s) => {
    const ms = toMs(s?.scheduledStartAt);
    if (ms == null) return true;
    return ms >= now;
  });

  return { today, upcoming };
}
