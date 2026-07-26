/**
 * The scenario the product owner asked to be proven: one vital type holds MORE readings
 * in the 30-day window than a single sync imports (2100 > MAX_SAMPLES_PER_TYPE).
 *
 * Sync 1 must import the ceiling and report truncation.
 * Sync 2 must reach the REMAINING readings — not re-read the first batch —
 * and only then may the operation count as complete.
 */
import test from "node:test";
import assert from "node:assert/strict";

const bridge = await import("../healthBridge.js");
const { syncHealthData, SYNC_RESULT } = await import("../healthSync.js");
const { MAX_SAMPLES_PER_TYPE, SAMPLES_PER_PAGE, __setHealthPluginForTests } = bridge;

const TOTAL = 2100;
const T0 = Date.parse("2026-07-01T00:00:00.000Z");
/** 2100 heart-rate samples, one per minute, each with a unique platform id. */
const ALL = Array.from({ length: TOTAL }, (_, i) => ({
  dataType: "heartRate", value: 60 + (i % 30), unit: "bpm",
  endDate: new Date(T0 + i * 60_000).toISOString(),
  platformId: `hr-${i}`,
}));

/** A fake Apple Health that honours startDate/limit/ascending like the real one should. */
function fakeHealthStore() {
  __setHealthPluginForTests({
    // The patient granted exactly this one type.
    checkAuthorization: async () => ({ readAuthorized: ["heartRate"], readDenied: [] }),
    readSamples: async ({ startDate, limit, ascending }) => {
      assert.equal(ascending, true, "must page forwards in time");
      const from = Date.parse(startDate);
      const page = ALL.filter((s) => Date.parse(s.endDate) >= from).slice(0, limit);
      return { samples: page };
    },
  });
  globalThis.window = { Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" } };
}

/** Server stand-in: real dedup by externalId + real checkpoint/lastSyncedAt semantics. */
function fakeServer() {
  const stored = new Map();          // externalId -> entry
  const state = { lastSyncedAt: null, checkpoints: {} };
  return {
    state,
    stored,
    importEntries: async ({ entries, finalizeSync, checkpoints, complete }) => {
      assert.ok(entries.length <= 200, `chunk of ${entries.length} exceeds the server cap`);
      let imported = 0, duplicates = 0;
      for (const e of entries) {
        if (stored.has(e.externalId)) duplicates += 1;
        else { stored.set(e.externalId, e); imported += 1; }
      }
      if (finalizeSync === true) {
        for (const [t, v] of Object.entries(checkpoints || {})) {
          if (v === null) delete state.checkpoints[t]; else state.checkpoints[t] = v;
        }
        const open = Object.keys(state.checkpoints).length > 0;
        if (complete === true && !open) state.lastSyncedAt = new Date().toISOString();
      }
      return { res: { ok: true }, data: { ok: true, imported, duplicates, skipped: [] } };
    },
  };
}

test(`${TOTAL} readings: first sync caps and reports, second sync reaches the rest`, async () => {
  fakeHealthStore();
  const srv = fakeServer();
  const deps = { importEntries: srv.importEntries, now: () => Date.parse("2026-07-26T12:00:00.000Z") };

  // ── Sync 1 ───────────────────────────────────────────────────────────────
  const r1 = await syncHealthData({
    scopes: ["heart_rate"], lastSyncedAt: srv.state.lastSyncedAt,
    checkpoints: srv.state.checkpoints, deps,
  });
  assert.equal(r1.result, SYNC_RESULT.OK);
  assert.deepEqual(r1.truncatedTypes, ["heart_rate"], "truncation must be reported, not silent");
  assert.equal(r1.imported, MAX_SAMPLES_PER_TYPE, `expected the ${MAX_SAMPLES_PER_TYPE} ceiling`);
  assert.equal(srv.stored.size, MAX_SAMPLES_PER_TYPE);
  assert.equal(srv.state.lastSyncedAt, null,
    "lastSyncedAt must NOT advance while readings are still outstanding");
  assert.ok(srv.state.checkpoints.heart_rate, "a resume point must be kept for this type");

  // ── Sync 2: must continue AFTER the checkpoint ───────────────────────────
  const r2 = await syncHealthData({
    scopes: ["heart_rate"], lastSyncedAt: srv.state.lastSyncedAt,
    checkpoints: srv.state.checkpoints, deps,
  });
  assert.equal(r2.result, SYNC_RESULT.OK);
  assert.equal(r2.imported, TOTAL - MAX_SAMPLES_PER_TYPE,
    "the second sync must import exactly the remainder");
  assert.ok(r2.duplicates <= 2,
    `only the boundary reading may repeat, saw ${r2.duplicates}`);
  assert.equal(srv.stored.size, TOTAL, "every reading is stored exactly once");

  // ── Completion ───────────────────────────────────────────────────────────
  assert.deepEqual(r2.truncatedTypes, [], "nothing left over on the second pass");
  assert.equal(Object.keys(srv.state.checkpoints).length, 0, "resume point cleared once done");
  assert.ok(srv.state.lastSyncedAt, "only now may lastSyncedAt advance");
});

test("a third sync finds nothing new and creates no duplicates", async () => {
  fakeHealthStore();
  const srv = fakeServer();
  const deps = { importEntries: srv.importEntries, now: () => Date.parse("2026-07-26T12:00:00.000Z") };
  const opts = () => ({ scopes: ["heart_rate"], lastSyncedAt: srv.state.lastSyncedAt,
                        checkpoints: srv.state.checkpoints, deps });
  await syncHealthData(opts());
  await syncHealthData(opts());
  const before = srv.stored.size;
  const r3 = await syncHealthData(opts());
  assert.equal(srv.stored.size, before, "a repeat sync must not add anything");
  assert.equal(r3.imported, 0);
});
