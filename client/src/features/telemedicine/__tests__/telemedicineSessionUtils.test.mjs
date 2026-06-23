/**
 * Unit tests for telemedicineSessionUtils.js — the pure logic shared by the
 * practice and patient Videosprechstunden pages.
 * Run: node --test client/src/features/telemedicine/__tests__/telemedicineSessionUtils.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_STATUSES,
  TERMINAL_STATUSES,
  OPEN_STATUSES,
  isTerminalStatus,
  isOpenStatus,
  statusLabelKey,
  participantLabelKey,
  isExpiredSession,
  canPatientJoin,
  waitingPatients,
  partitionPracticeSessions,
} from "../telemedicineSessionUtils.js";

const NOW = new Date("2026-06-23T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

test("status constants are coherent", () => {
  assert.deepEqual(SESSION_STATUSES, [
    "planned",
    "waiting",
    "active",
    "completed",
    "cancelled",
    "failed",
  ]);
  // terminal + open partition the full status set without overlap
  assert.deepEqual([...OPEN_STATUSES, ...TERMINAL_STATUSES].sort(), [...SESSION_STATUSES].sort());
  for (const s of OPEN_STATUSES) assert.ok(!TERMINAL_STATUSES.includes(s));
});

test("isTerminalStatus / isOpenStatus", () => {
  for (const s of ["completed", "cancelled", "failed"]) assert.equal(isTerminalStatus(s), true);
  for (const s of ["planned", "waiting", "active"]) assert.equal(isTerminalStatus(s), false);
  assert.equal(isTerminalStatus("unknown"), false);
  assert.equal(isOpenStatus("planned"), true);
  assert.equal(isOpenStatus("completed"), false);
});

test("label key helpers", () => {
  assert.equal(statusLabelKey("waiting"), "status_waiting");
  assert.equal(participantLabelKey("joined"), "participant_joined");
});

test("isExpiredSession edge cases", () => {
  assert.equal(isExpiredSession(null, NOW), false);
  assert.equal(isExpiredSession({ status: "planned" }, NOW), false); // no scheduledEndAt
  // only planned/waiting can expire
  assert.equal(
    isExpiredSession({ status: "active", scheduledEndAt: new Date(NOW - HOUR) }, NOW),
    false,
  );
  assert.equal(
    isExpiredSession({ status: "completed", scheduledEndAt: new Date(NOW - HOUR) }, NOW),
    false,
  );
  // planned/waiting with end in the past => expired
  assert.equal(
    isExpiredSession({ status: "planned", scheduledEndAt: new Date(NOW - HOUR) }, NOW),
    true,
  );
  assert.equal(
    isExpiredSession({ status: "waiting", scheduledEndAt: new Date(NOW - 1) }, NOW),
    true,
  );
  // end in the future => not expired
  assert.equal(
    isExpiredSession({ status: "planned", scheduledEndAt: new Date(NOW + HOUR) }, NOW),
    false,
  );
});

test("canPatientJoin gate", () => {
  assert.equal(canPatientJoin(null, NOW), false);
  assert.equal(
    canPatientJoin({ status: "active", linkRevoked: true }, NOW),
    false,
    "revoked link blocks join",
  );
  assert.equal(
    canPatientJoin({ status: "completed" }, NOW),
    false,
    "terminal status blocks join",
  );
  assert.equal(
    canPatientJoin({ status: "planned", scheduledEndAt: new Date(NOW - HOUR) }, NOW),
    false,
    "expired slot blocks join",
  );
  assert.equal(
    canPatientJoin({ status: "planned", scheduledEndAt: new Date(NOW + HOUR) }, NOW),
    true,
  );
  assert.equal(canPatientJoin({ status: "active" }, NOW), true, "active, no end, not revoked");
});

test("waitingPatients filters to present patient participants", () => {
  assert.deepEqual(waitingPatients(undefined), []);
  assert.deepEqual(waitingPatients(null), []);
  const participants = [
    { id: "a", role: "patient", status: "waiting" },
    { id: "b", role: "patient", status: "joined" },
    { id: "c", role: "patient", status: "left" },
    { id: "d", role: "patient", status: "invited" },
    { id: "e", role: "practice", status: "joined" },
    null,
  ];
  const result = waitingPatients(participants);
  assert.deepEqual(
    result.map((p) => p.id),
    ["a", "b"],
    "only patient role with waiting/joined status",
  );
});

test("partitionPracticeSessions buckets", () => {
  assert.deepEqual(partitionPracticeSessions(undefined, NOW), { today: [], upcoming: [] });

  const earlierToday = { id: "earlier", scheduledStartAt: new Date(NOW - HOUR) };
  const laterToday = { id: "later", scheduledStartAt: new Date(NOW + HOUR) };
  const adHoc = { id: "adhoc", scheduledStartAt: null };
  const yesterday = { id: "yest", scheduledStartAt: new Date(NOW - 1.5 * DAY) };
  const tomorrow = { id: "tom", scheduledStartAt: new Date(NOW + 1.5 * DAY) };

  const { today, upcoming } = partitionPracticeSessions(
    [earlierToday, laterToday, adHoc, yesterday, tomorrow],
    NOW,
  );

  // today bucket: both of today's sessions, not yesterday/tomorrow/adhoc
  assert.deepEqual(today.map((s) => s.id).sort(), ["earlier", "later"]);
  // upcoming: now-or-later scheduled + ad-hoc (no start); never past sessions
  assert.equal(upcoming.some((s) => s.id === "later"), true);
  assert.equal(upcoming.some((s) => s.id === "tom"), true);
  assert.equal(upcoming.some((s) => s.id === "adhoc"), true, "ad-hoc has no start => upcoming");
  assert.equal(upcoming.some((s) => s.id === "earlier"), false, "earlier today already passed");
  assert.equal(upcoming.some((s) => s.id === "yest"), false, "yesterday is not upcoming");
});
