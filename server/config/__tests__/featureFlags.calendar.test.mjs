/**
 * Confirms the practice calendar feature is available by default (the fix for
 * the red "Funktion deaktiviert" message) and that the gate middleware behaves
 * accordingly. Run:
 *   node --test server/config/__tests__/featureFlags.calendar.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { isPracticeCalendarEnabled } from "../featureFlags.js";
import { requirePracticeCalendarFeature } from "../../middleware/requirePracticeCalendar.js";

const ENV = "ENABLE_PRACTICE_CALENDAR";
const original = process.env[ENV];

function restore() {
  if (original === undefined) delete process.env[ENV];
  else process.env[ENV] = original;
}

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("calendar is enabled by default (env unset) — no more feature_disabled", () => {
  delete process.env[ENV];
  try {
    assert.equal(isPracticeCalendarEnabled(), true);
  } finally {
    restore();
  }
});

test("calendar can still be explicitly disabled via env", () => {
  process.env[ENV] = "false";
  try {
    assert.equal(isPracticeCalendarEnabled(), false);
  } finally {
    restore();
  }
});

test("explicit true keeps it enabled", () => {
  process.env[ENV] = "true";
  try {
    assert.equal(isPracticeCalendarEnabled(), true);
  } finally {
    restore();
  }
});

test("gate middleware lets requests through when the feature is available", () => {
  delete process.env[ENV];
  try {
    const res = fakeRes();
    let nextCalled = false;
    requirePracticeCalendarFeature({}, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true, "next() called → calendar routes reachable");
    assert.equal(res.statusCode, null, "no 404 emitted");
  } finally {
    restore();
  }
});

test("gate middleware returns 404 feature_disabled only when explicitly off", () => {
  process.env[ENV] = "false";
  try {
    const res = fakeRes();
    let nextCalled = false;
    requirePracticeCalendarFeature({}, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { ok: false, error: "feature_disabled" });
  } finally {
    restore();
  }
});
