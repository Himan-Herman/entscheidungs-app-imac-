/**
 * Unit tests for the calendar day/month view bucketing (fix for "Monat
 * funktioniert nicht"). Run:
 *   node --test client/src/features/practiceCalendar/__tests__/calendarViewUtils.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  appointmentsOnDay,
  appointmentsInMonth,
  groupAppointmentsByDay,
} from "../calendarViewUtils.js";

const NOW = new Date(2026, 5, 15, 10, 0, 0).getTime(); // 15 June 2026, local
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const appts = [
  { id: "today1", startAt: new Date(NOW).toISOString() },
  { id: "today2", startAt: new Date(NOW + 3 * HOUR).toISOString() }, // same day
  { id: "tomorrow", startAt: new Date(NOW + DAY).toISOString() },
  { id: "july", startAt: new Date(2026, 6, 5, 9, 0, 0).toISOString() }, // next month
  { id: "nostart", startAt: null },
];

test("appointmentsOnDay returns only the given day's appointments", () => {
  const ids = appointmentsOnDay(appts, NOW).map((a) => a.id).sort();
  assert.deepEqual(ids, ["today1", "today2"]);
  assert.deepEqual(appointmentsOnDay(undefined, NOW), []);
  assert.deepEqual(appointmentsOnDay([], NOW), []);
});

test("appointmentsInMonth keeps only the current calendar month", () => {
  const ids = appointmentsInMonth(appts, NOW).map((a) => a.id).sort();
  assert.deepEqual(ids, ["today1", "today2", "tomorrow"]); // July + no-start excluded
});

test("groupAppointmentsByDay buckets by day, sorted ascending", () => {
  const groups = groupAppointmentsByDay(appointmentsInMonth(appts, NOW));
  assert.equal(groups.length, 2);
  assert.ok(groups[0].dateMs < groups[1].dateMs, "sorted ascending by day");
  assert.deepEqual(groups[0].items.map((a) => a.id).sort(), ["today1", "today2"]);
  assert.deepEqual(groups[1].items.map((a) => a.id), ["tomorrow"]);
  assert.deepEqual(groupAppointmentsByDay([]), []);
  assert.deepEqual(groupAppointmentsByDay([{ id: "x", startAt: null }]), []);
});
