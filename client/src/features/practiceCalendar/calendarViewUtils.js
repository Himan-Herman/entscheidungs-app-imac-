/**
 * Pure helpers for the calendar view switcher (Liste / Tag / Woche / Monat).
 * Dependency-free so the day/month bucketing is unit-testable under node --test.
 */

function sameLocalDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Appointments that start on the given day (defaults to today). */
export function appointmentsOnDay(appointments, nowMs = Date.now()) {
  const list = Array.isArray(appointments) ? appointments : [];
  return list.filter((a) => a && a.startAt && sameLocalDay(a.startAt, nowMs));
}

/** Appointments that start within the calendar month of `nowMs` (defaults to now). */
export function appointmentsInMonth(appointments, nowMs = Date.now()) {
  const ref = new Date(nowMs);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const list = Array.isArray(appointments) ? appointments : [];
  return list.filter((a) => {
    if (!a || !a.startAt) return false;
    const s = new Date(a.startAt);
    return s.getFullYear() === y && s.getMonth() === m;
  });
}

/** Group appointments into day buckets sorted ascending: [{ dateMs, items }]. */
export function groupAppointmentsByDay(appointments) {
  const map = new Map();
  for (const a of Array.isArray(appointments) ? appointments : []) {
    if (!a || !a.startAt) continue;
    const s = new Date(a.startAt);
    const dateMs = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
    if (!map.has(dateMs)) map.set(dateMs, { dateMs, items: [] });
    map.get(dateMs).items.push(a);
  }
  return [...map.values()].sort((a, b) => a.dateMs - b.dateMs);
}
