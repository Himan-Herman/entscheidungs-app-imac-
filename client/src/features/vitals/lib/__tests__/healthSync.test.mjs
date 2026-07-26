/** Foreground sync orchestration — every failure case from the Phase-2 brief. */
import test from "node:test";
import assert from "node:assert/strict";

const { syncHealthData, SYNC_RESULT } = await import("../healthSync.js");

const ok = (data) => async () => ({ res: { ok: true }, data: { ok: true, ...data } });
const base = {
  getProvider: () => "apple_health",
  checkAccess: async () => ({ authorized: ["heart_rate", "weight"], denied: [] }),
  readEntries: async () => ({ entries: [{ type: "heart_rate", externalId: "a" }], failedTypes: [] }),
  importEntries: ok({ imported: 1, duplicates: 0, skipped: [] }),
  now: () => Date.parse("2026-07-26T12:00:00.000Z"),
};
const run = (over = {}, args = {}) =>
  syncHealthData({ scopes: ["heart_rate", "weight"], lastSyncedAt: null, deps: { ...base, ...over }, ...args });

test("happy path imports and reports counts", async () => {
  const r = await run();
  assert.equal(r.result, SYNC_RESULT.OK);
  assert.equal(r.imported, 1);
});

test("web / no native platform → no_platform, nothing sent", async () => {
  let called = false;
  const r = await run({ getProvider: () => null, importEntries: async () => { called = true; } });
  assert.equal(r.result, SYNC_RESULT.NO_PLATFORM);
  assert.equal(called, false, "must not contact the server");
});

test("permission fully denied → no_permission, nothing sent", async () => {
  let called = false;
  const r = await run({
    checkAccess: async () => ({ authorized: [], denied: ["heart_rate", "weight"] }),
    importEntries: async () => { called = true; },
  });
  assert.equal(r.result, SYNC_RESULT.NO_PERMISSION);
  assert.deepEqual(r.deniedTypes, ["heart_rate", "weight"]);
  assert.equal(called, false);
});

test("partial permission syncs only the granted types", async () => {
  let askedFor = null;
  const r = await run({
    checkAccess: async () => ({ authorized: ["weight"], denied: ["heart_rate"] }),
    readEntries: async ({ vitalTypes }) => { askedFor = vitalTypes; return { entries: [{ externalId: "w" }], failedTypes: [] }; },
  });
  assert.deepEqual(askedFor, ["weight"], "denied types must not be read");
  assert.deepEqual(r.deniedTypes, ["heart_rate"]);
  assert.equal(r.result, SYNC_RESULT.OK);
});

test("OS grants a type outside the MedScoutX consent scope → still not read", async () => {
  let askedFor = null;
  await syncHealthData({
    scopes: ["weight"],
    deps: { ...base,
      checkAccess: async () => ({ authorized: ["weight", "glucose"], denied: [] }),
      readEntries: async ({ vitalTypes }) => { askedFor = vitalTypes; return { entries: [{ externalId: "w" }], failedTypes: [] }; } },
  });
  assert.deepEqual(askedFor, ["weight"], "glucose is outside the app-level consent");
});

test("no data available → nothing_new, no server call", async () => {
  let called = false;
  const r = await run({
    readEntries: async () => ({ entries: [], failedTypes: [] }),
    importEntries: async () => { called = true; },
  });
  assert.equal(r.result, SYNC_RESULT.NOTHING_NEW);
  assert.equal(called, false);
});

test("server rejects (e.g. 409 not_connected) → server_error", async () => {
  const r = await run({ importEntries: async () => ({ res: { ok: false }, data: { ok: false, error: "not_connected" } }) });
  assert.equal(r.result, SYNC_RESULT.SERVER_ERROR);
  assert.equal(r.imported, 0);
});

test("network offline → offline, never throws", async () => {
  const r = await run({ importEntries: async () => { throw new TypeError("Failed to fetch"); } });
  assert.equal(r.result, SYNC_RESULT.OFFLINE);
});

test("expired session propagates so the app can redirect to login", async () => {
  await assert.rejects(
    () => run({ importEntries: async () => { throw new Error("SESSION_EXPIRED"); } }),
    /SESSION_EXPIRED/,
  );
});

test("duplicate re-sync is reported as duplicates, not imports", async () => {
  const r = await run({ importEntries: ok({ imported: 0, duplicates: 3, skipped: [] }) });
  assert.equal(r.result, SYNC_RESULT.OK);
  assert.equal(r.imported, 0);
  assert.equal(r.duplicates, 3);
});

test("server-side skips (invalid units / future timestamps) are counted", async () => {
  const r = await run({ importEntries: ok({ imported: 1, duplicates: 0, skipped: [{ reason: "date_in_future" }, { reason: "value_out_of_range" }] }) });
  assert.equal(r.skipped, 2);
});

test("a type failing at read time is surfaced but does not abort", async () => {
  const r = await run({ readEntries: async () => ({ entries: [{ externalId: "a" }], failedTypes: ["glucose"] }) });
  assert.equal(r.result, SYNC_RESULT.OK);
  assert.deepEqual(r.failedTypes, ["glucose"]);
});

test("subsequent sync starts from lastSyncedAt, not the full window", async () => {
  let start = null;
  await run({ readEntries: async ({ startDate }) => { start = startDate; return { entries: [], failedTypes: [] }; } },
             { lastSyncedAt: "2026-07-25T12:00:00.000Z" });
  assert.equal(Date.parse("2026-07-25T12:00:00.000Z") - Date.parse(start), 3600_000);
});

// ── Chunked upload: a full 30-day window must not be rejected wholesale ─────
const { MAX_UPLOAD_CHUNK } = await import("../healthSync.js");

test("a batch larger than the server cap is uploaded in chunks", async () => {
  const big = Array.from({ length: 470 }, (_, i) => ({ type: "heart_rate", externalId: `e${i}` }));
  const sizes = [];
  const r = await run({
    readEntries: async () => ({ entries: big, failedTypes: [] }),
    importEntries: async ({ entries }) => {
      sizes.push(entries.length);
      return { res: { ok: true }, data: { ok: true, imported: entries.length, duplicates: 0, skipped: [] } };
    },
  });
  assert.equal(r.result, SYNC_RESULT.OK);
  assert.deepEqual(sizes, [200, 200, 70], "must be split into server-sized chunks");
  assert.ok(sizes.every((n) => n <= MAX_UPLOAD_CHUNK));
  assert.equal(r.imported, 470, "counts accumulate across chunks");
});

test("counts from all chunks are summed, not overwritten", async () => {
  const many = Array.from({ length: 300 }, (_, i) => ({ type: "weight", externalId: `w${i}` }));
  let call = 0;
  const r = await run({
    readEntries: async () => ({ entries: many, failedTypes: [] }),
    importEntries: async () => {
      call += 1;
      return call === 1
        ? { res: { ok: true }, data: { ok: true, imported: 150, duplicates: 50, skipped: [{ reason: "x" }] } }
        : { res: { ok: true }, data: { ok: true, imported: 40, duplicates: 60, skipped: [] } };
    },
  });
  assert.equal(r.imported, 190);
  assert.equal(r.duplicates, 110);
  assert.equal(r.skipped, 1);
});

test("a failing later chunk keeps the values already imported", async () => {
  const many = Array.from({ length: 300 }, (_, i) => ({ type: "weight", externalId: `w${i}` }));
  let call = 0;
  const r = await run({
    readEntries: async () => ({ entries: many, failedTypes: [] }),
    importEntries: async () => {
      call += 1;
      return call === 1
        ? { res: { ok: true }, data: { ok: true, imported: 200, duplicates: 0, skipped: [] } }
        : { res: { ok: false }, data: { ok: false, error: "request_failed" } };
    },
  });
  assert.equal(r.result, SYNC_RESULT.SERVER_ERROR);
  assert.equal(r.imported, 200, "the first chunk's 200 readings must not be reported as lost");
});

test("offline midway still reports what already succeeded", async () => {
  const many = Array.from({ length: 300 }, (_, i) => ({ type: "weight", externalId: `w${i}` }));
  let call = 0;
  const r = await run({
    readEntries: async () => ({ entries: many, failedTypes: [] }),
    importEntries: async () => {
      call += 1;
      if (call === 1) return { res: { ok: true }, data: { ok: true, imported: 200, duplicates: 0, skipped: [] } };
      throw new TypeError("Failed to fetch");
    },
  });
  assert.equal(r.result, SYNC_RESULT.OFFLINE);
  assert.equal(r.imported, 200);
});
