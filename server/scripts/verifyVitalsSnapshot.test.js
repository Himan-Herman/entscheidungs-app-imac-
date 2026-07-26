/**
 * Vitals snapshot — server-side sanitiser.
 * Guarantees data minimisation even against a tampered client.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeVitalsSnapshot,
  withSanitizedVitalsSnapshot,
} from "../services/vitals/vitalsSnapshotSanitizer.js";

const past = new Date(Date.now() - 3600_000).toISOString();
const ok = (over = {}) => ({
  type: "heart_rate", valuePrimary: 70, measuredAt: past, unit: "bpm", ...over,
});

test("accepts a well-formed snapshot", () => {
  const s = sanitizeVitalsSnapshot({ version: 1, createdAt: past, maxAgeDays: 90, items: [ok()] });
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].type, "heart_rate");
  assert.equal(s.items[0].source, "manual");
});

test("STRIPS free-text notes and any unknown key (data minimisation)", () => {
  const s = sanitizeVitalsSnapshot({
    items: [ok({ notes: "streng geheim", secretField: "x", patientName: "Max" })],
  });
  assert.equal("notes" in s.items[0], false, "notes must never survive");
  assert.equal("secretField" in s.items[0], false);
  assert.equal("patientName" in s.items[0], false);
  assert.deepEqual(
    Object.keys(s.items[0]).sort(),
    ["measuredAt","source","sourceProvider","type","unit","valuePrimary","valueSecondary"]
  );
});

test("rejects implausible values and unknown types", () => {
  assert.equal(sanitizeVitalsSnapshot({ items: [ok({ valuePrimary: 99999 })] }), null);
  assert.equal(sanitizeVitalsSnapshot({ items: [ok({ type: "bitcoin_balance" })] }), null);
  assert.equal(sanitizeVitalsSnapshot({ items: [ok({ valuePrimary: "abc" })] }), null);
});

test("rejects future measurements", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(sanitizeVitalsSnapshot({ items: [ok({ measuredAt: future })] }), null);
});

test("blood_pressure requires a valid diastolic", () => {
  assert.equal(sanitizeVitalsSnapshot({ items: [{ type:"blood_pressure", valuePrimary:120, measuredAt:past }] }), null);
  const good = sanitizeVitalsSnapshot({ items: [{ type:"blood_pressure", valuePrimary:120, valueSecondary:80, measuredAt:past }] });
  assert.equal(good.items[0].valueSecondary, 80);
});

test("caps at one entry per type and at most 6 items", () => {
  const many = Array.from({ length: 50 }, (_, i) => ok({ valuePrimary: 60 + (i % 10) }));
  const s = sanitizeVitalsSnapshot({ items: many });
  assert.equal(s.items.length, 1, "duplicate types collapse to one");

  const allTypes = ["blood_pressure","heart_rate","glucose","weight","oxygen","temperature"]
    .map(t => t === "blood_pressure"
      ? { type:t, valuePrimary:120, valueSecondary:80, measuredAt:past }
      : { type:t, valuePrimary: t==="oxygen"?98 : t==="temperature"?36.6 : t==="weight"?70 : t==="glucose"?90 : 70, measuredAt:past });
  assert.equal(sanitizeVitalsSnapshot({ items: [...allTypes, ...allTypes] }).items.length, 6);
});

test("garbage input never throws — returns null", () => {
  for (const bad of [null, undefined, 42, "x", [], {}, { items: [] }, { items: "no" }, { items: [null] }]) {
    assert.equal(sanitizeVitalsSnapshot(bad), null);
  }
});

test("withSanitizedVitalsSnapshot leaves other answer keys untouched", () => {
  const answers = { appointmentReason: "Kontrolle", practiceContext: { qrToken: "abc" },
    vitalsSnapshot: { items: [ok({ notes: "geheim" })] } };
  const out = withSanitizedVitalsSnapshot(answers);
  assert.equal(out.appointmentReason, "Kontrolle");
  assert.deepEqual(out.practiceContext, { qrToken: "abc" });
  assert.equal("notes" in out.vitalsSnapshot.items[0], false);
});

test("withSanitizedVitalsSnapshot drops an unusable snapshot entirely", () => {
  const out = withSanitizedVitalsSnapshot({ a: 1, vitalsSnapshot: { items: [{ type: "junk" }] } });
  assert.equal("vitalsSnapshot" in out, false);
  assert.equal(out.a, 1);
});

test("answers without a snapshot pass through unchanged", () => {
  const answers = { appointmentReason: "x" };
  assert.equal(withSanitizedVitalsSnapshot(answers), answers);
});
