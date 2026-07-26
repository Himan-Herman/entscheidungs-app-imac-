/**
 * Native health bridge — pure logic (mapping, units, dedup) + plugin behaviour via a stub.
 * No native SDK involved: this proves the JS layer, NOT HealthKit/Health Connect itself.
 */
import test from "node:test";
import assert from "node:assert/strict";

const B = await import("../healthBridge.js");
const {
  normalizeHealthSample, normalizeHealthSamples, buildExternalId, resolveSyncStart,
  getHealthProvider, isHealthAvailable, requestHealthReadAccess, checkHealthReadAccess,
  readHealthEntries, __setHealthPluginForTests,
  VITAL_TO_HEALTH_TYPE, CANONICAL_UNIT, INITIAL_SYNC_DAYS,
} = B;

const asWeb = () => { delete globalThis.window; };
const asPlatform = (p) => {
  globalThis.window = { Capacitor: { isNativePlatform: () => true, getPlatform: () => p } };
};

// ── platform gating ────────────────────────────────────────────────────────
test("provider is platform-gated; web gets none", () => {
  asWeb();                assert.equal(getHealthProvider(), null);
  asPlatform("ios");      assert.equal(getHealthProvider(), "apple_health");
  asPlatform("android");  assert.equal(getHealthProvider(), "health_connect");
  asPlatform("electron"); assert.equal(getHealthProvider(), null);
});

test("only the six supported vital types are ever mapped", () => {
  assert.deepEqual(Object.keys(VITAL_TO_HEALTH_TYPE).sort(),
    ["blood_pressure","glucose","heart_rate","oxygen","temperature","weight"]);
  const mapped = Object.values(VITAL_TO_HEALTH_TYPE);
  for (const forbidden of ["steps","sleep","workouts","distance","calories"]) {
    assert.ok(!mapped.includes(forbidden), `${forbidden} must never be requested`);
  }
});

// ── normalisation / units ──────────────────────────────────────────────────
const S = (o) => ({ startDate: "2026-07-20T08:00:00.000Z", endDate: "2026-07-20T08:00:00.000Z", ...o });

test("blood pressure uses systolic/diastolic, not value", () => {
  const e = normalizeHealthSample(S({ dataType:"bloodPressure", value:0, systolic:118, diastolic:76, unit:"mmHg", platformId:"bp-1" }));
  assert.equal(e.type, "blood_pressure");
  assert.equal(e.valuePrimary, 118);
  assert.equal(e.valueSecondary, 76);
  assert.equal(e.unit, "mmHg");
});

test("blood pressure without diastolic is rejected", () => {
  assert.equal(normalizeHealthSample(S({ dataType:"bloodPressure", systolic:120, unit:"mmHg", platformId:"x" })), null);
});

test("Fahrenheit is converted to Celsius", () => {
  const e = normalizeHealthSample(S({ dataType:"bodyTemperature", value:98.6, unit:"fahrenheit", platformId:"t-1" }));
  assert.equal(e.valuePrimary, 37);
  assert.equal(e.unit, "°C");
});

test("Celsius passes through unchanged", () => {
  const e = normalizeHealthSample(S({ dataType:"bodyTemperature", value:36.6, unit:"celsius", platformId:"t-2" }));
  assert.equal(e.valuePrimary, 36.6);
});

test("SpO2 fraction (HealthKit) becomes percent; percent stays percent", () => {
  const frac = normalizeHealthSample(S({ dataType:"oxygenSaturation", value:0.98, unit:"percent", platformId:"o-1" }));
  assert.equal(frac.valuePrimary, 98, "0.98 must become 98 %");
  const pct = normalizeHealthSample(S({ dataType:"oxygenSaturation", value:97, unit:"percent", platformId:"o-2" }));
  assert.equal(pct.valuePrimary, 97);
});

test("float noise is rounded to one decimal", () => {
  const e = normalizeHealthSample(S({ dataType:"weight", value:72.44999999999999, unit:"kilogram", platformId:"w-1" }));
  assert.equal(e.valuePrimary, 72.4);
  assert.equal(e.unit, "kg");
});

test("unsupported data types are dropped (steps, sleep)", () => {
  for (const dt of ["steps","sleep","workouts","distance"]) {
    assert.equal(normalizeHealthSample(S({ dataType: dt, value: 1000, unit:"count", platformId:"s" })), null);
  }
});

test("invalid input never throws", () => {
  for (const bad of [null, undefined, 42, "x", {}, { dataType:"heartRate" }]) {
    assert.equal(normalizeHealthSample(bad), null);
  }
});

test("invalid or missing timestamp is rejected", () => {
  assert.equal(normalizeHealthSample({ dataType:"heartRate", value:70, unit:"bpm", endDate:"kaputt" }), null);
  assert.equal(normalizeHealthSample({ dataType:"heartRate", value:70, unit:"bpm" }), null);
});

// ── dedup ──────────────────────────────────────────────────────────────────
test("platformId is used as the dedup key when present", () => {
  const e = normalizeHealthSample(S({ dataType:"heartRate", value:64, unit:"bpm", platformId:"HK-UUID-123" }));
  assert.equal(e.externalId, "HK-UUID-123");
});

test("missing platformId falls back to a deterministic composite", () => {
  const s = S({ dataType:"heartRate", value:64, unit:"bpm" });
  const a = normalizeHealthSample(s), b = normalizeHealthSample({ ...s });
  assert.equal(a.externalId, b.externalId, "same sample must yield the same id");
  assert.match(a.externalId, /^heart_rate:\d+:64$/);
});

test("externalId is capped at the server limit (191)", () => {
  const e = normalizeHealthSample(S({ dataType:"heartRate", value:64, unit:"bpm", platformId:"x".repeat(500) }));
  assert.equal(e.externalId.length, 191);
});

test("duplicates inside one batch collapse; re-sync yields identical ids", () => {
  const s = S({ dataType:"heartRate", value:64, unit:"bpm", platformId:"dup" });
  const first = normalizeHealthSamples([s, { ...s }, S({ dataType:"weight", value:70, unit:"kilogram", platformId:"w" })]);
  assert.equal(first.length, 2);
  const second = normalizeHealthSamples([s]);
  assert.equal(second[0].externalId, "dup", "second sync produces the same id → server dedups");
});

test("normalizeHealthSamples tolerates garbage input", () => {
  assert.deepEqual(normalizeHealthSamples(null), []);
  assert.deepEqual(normalizeHealthSamples([null, 1, "x"]), []);
});

// ── sync window ────────────────────────────────────────────────────────────
test("first sync uses a bounded window, not the whole history", () => {
  const now = Date.parse("2026-07-26T12:00:00.000Z");
  const start = Date.parse(resolveSyncStart(null, now));
  assert.equal(Math.round((now - start) / 86400000), INITIAL_SYNC_DAYS);
});

test("later syncs start from the last sync with a small overlap", () => {
  const now = Date.parse("2026-07-26T12:00:00.000Z");
  const last = "2026-07-25T12:00:00.000Z";
  const start = Date.parse(resolveSyncStart(last, now));
  assert.equal(Date.parse(last) - start, 3600_000, "one hour overlap");
});

test("a future lastSyncedAt falls back to the bounded window", () => {
  const now = Date.parse("2026-07-26T12:00:00.000Z");
  const start = Date.parse(resolveSyncStart("2027-01-01T00:00:00.000Z", now));
  assert.ok(start < now);
});

// ── plugin behaviour via stub ──────────────────────────────────────────────
test("availability: false on web, false when plugin missing", async () => {
  asWeb(); __setHealthPluginForTests({ isAvailable: async () => ({ available: true }) });
  assert.equal(await isHealthAvailable(), false, "web must never report available");
  asPlatform("ios"); __setHealthPluginForTests(undefined);
  assert.equal(await isHealthAvailable(), false);
});

test("availability: plugin throwing is treated as unavailable", async () => {
  asPlatform("ios");
  __setHealthPluginForTests({ isAvailable: async () => { throw new Error("no HealthKit"); } });
  assert.equal(await isHealthAvailable(), false);
});

test("permission request asks for READ only — never write", async () => {
  asPlatform("ios");
  let captured = null;
  __setHealthPluginForTests({
    requestAuthorization: async (o) => { captured = o; return { readAuthorized: ["heartRate"], readDenied: ["bloodGlucose"] }; },
  });
  const res = await requestHealthReadAccess(["heart_rate", "glucose"]);
  assert.deepEqual(Object.keys(captured), ["read"], "no write key may be sent");
  assert.deepEqual(captured.read, ["heartRate", "bloodGlucose"]);
  assert.deepEqual(res.authorized, ["heart_rate"]);
  assert.deepEqual(res.denied, ["glucose"]);
});

test("partial permission is reported faithfully", async () => {
  asPlatform("android");
  __setHealthPluginForTests({
    checkAuthorization: async () => ({ readAuthorized: ["weight"], readDenied: ["bloodPressure","heartRate"] }),
  });
  const res = await checkHealthReadAccess();
  assert.deepEqual(res.authorized, ["weight"]);
  assert.deepEqual(res.denied.sort(), ["blood_pressure","heart_rate"]);
});

test("revoked permission later reads as denied, never throws", async () => {
  asPlatform("android");
  __setHealthPluginForTests({ checkAuthorization: async () => { throw new Error("revoked"); } });
  assert.deepEqual(await checkHealthReadAccess(), { authorized: [], denied: [] });
});

test("one unauthorized type does not abort the whole read", async () => {
  asPlatform("ios");
  __setHealthPluginForTests({
    readSamples: async ({ dataType }) => {
      if (dataType === "bloodGlucose") throw new Error("not authorized");
      if (dataType === "heartRate") return { samples: [S({ dataType:"heartRate", value:64, unit:"bpm", platformId:"hr" })] };
      return { samples: [] };
    },
  });
  const { entries, failedTypes } = await readHealthEntries({ vitalTypes: ["heart_rate","glucose"] });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, "heart_rate");
  assert.deepEqual(failedTypes, ["glucose"]);
});

test("no data available yields an empty result, not an error", async () => {
  asPlatform("android");
  __setHealthPluginForTests({ readSamples: async () => ({ samples: [] }) });
  const { entries, failedTypes } = await readHealthEntries({});
  assert.deepEqual(entries, []);
  assert.deepEqual(failedTypes, []);
});

test("missing plugin yields empty results rather than crashing", async () => {
  asPlatform("ios");
  __setHealthPluginForTests(undefined);
  assert.deepEqual(await readHealthEntries({}), { entries: [], failedTypes: [] });
  assert.deepEqual(await requestHealthReadAccess(), { authorized: [], denied: [] });
});

test("every canonical unit matches the server's expected unit", () => {
  assert.deepEqual(CANONICAL_UNIT, {
    blood_pressure: "mmHg", heart_rate: "bpm", glucose: "mg/dL",
    weight: "kg", oxygen: "%", temperature: "°C",
  });
});
