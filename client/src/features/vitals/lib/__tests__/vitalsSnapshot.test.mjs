import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVitalsSnapshot, formatSnapshotLines, formatSnapshotValue, isValidSnapshot,
} from "../vitalsSnapshot.js";

const NOW = Date.parse("2026-07-25T12:00:00.000Z");
const daysAgo = d => new Date(NOW - d*86400000).toISOString();

test("keeps only the MOST RECENT reading per type", () => {
  const s = buildVitalsSnapshot([
    { type:"heart_rate", valuePrimary:60, unit:"bpm", measuredAt: daysAgo(10), source:"manual" },
    { type:"heart_rate", valuePrimary:75, unit:"bpm", measuredAt: daysAgo(1),  source:"manual" },
    { type:"heart_rate", valuePrimary:68, unit:"bpm", measuredAt: daysAgo(5),  source:"manual" },
  ], { now: NOW });
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].valuePrimary, 75, "newest wins");
});

test("NEVER includes notes (data minimisation)", () => {
  const s = buildVitalsSnapshot([
    { type:"weight", valuePrimary:70, unit:"kg", measuredAt: daysAgo(1), notes:"privat!", source:"manual" },
  ], { now: NOW });
  assert.equal("notes" in s.items[0], false);
});

test("drops readings older than the window", () => {
  const s = buildVitalsSnapshot([
    { type:"weight", valuePrimary:70, unit:"kg", measuredAt: daysAgo(200), source:"manual" },
  ], { now: NOW });
  assert.equal(s, null, "nothing recent -> no snapshot");
});

test("keeps device provenance", () => {
  const s = buildVitalsSnapshot([
    { type:"heart_rate", valuePrimary:66, unit:"bpm", measuredAt: daysAgo(1), source:"import", sourceProvider:"apple_health" },
  ], { now: NOW });
  assert.equal(s.items[0].source, "import");
  assert.equal(s.items[0].sourceProvider, "apple_health");
});

test("stable display order regardless of input order", () => {
  const mk = (t,v,extra={}) => ({ type:t, valuePrimary:v, unit:"", measuredAt: daysAgo(1), source:"manual", ...extra });
  const s = buildVitalsSnapshot([
    mk("temperature",36.6), mk("blood_pressure",120,{valueSecondary:80}), mk("weight",70),
  ], { now: NOW });
  assert.deepEqual(s.items.map(i=>i.type), ["blood_pressure","weight","temperature"]);
});

test("blood pressure formats as sys/dia", () => {
  assert.equal(formatSnapshotValue({ type:"blood_pressure", valuePrimary:118, valueSecondary:76 }), "118/76");
  assert.equal(formatSnapshotValue({ type:"weight", valuePrimary:70.57 }), "70.6");
  assert.equal(formatSnapshotValue({ type:"weight", valuePrimary:70 }), "70", "ganze Zahl bleibt ganz");
});

test("formatSnapshotLines renders label, value, unit, date", () => {
  const s = buildVitalsSnapshot([
    { type:"heart_rate", valuePrimary:66, unit:"bpm", measuredAt: daysAgo(1), source:"import", sourceProvider:"apple_health" },
  ], { now: NOW });
  const [line] = formatSnapshotLines(s, { typeLabels:{heart_rate:"Puls"}, locale:"de-DE", importedLabel:"vom Gerät" });
  assert.match(line, /^Puls: 66 bpm \(/);
  assert.match(line, /vom Gerät/);
});

test("empty / garbage input yields null, never throws", () => {
  for (const bad of [null, undefined, [], "x", 42, [{}], [{type:"junk"}]]) {
    assert.equal(buildVitalsSnapshot(bad, { now: NOW }), null);
  }
});

test("isValidSnapshot guards storage reads", () => {
  assert.equal(isValidSnapshot(null), false);
  assert.equal(isValidSnapshot({ items: [] }), false);
  assert.equal(isValidSnapshot({ items: [{ type:"junk", valuePrimary:1 }] }), false);
  assert.equal(isValidSnapshot({ items: [{ type:"weight", valuePrimary:70 }] }), true);
});
