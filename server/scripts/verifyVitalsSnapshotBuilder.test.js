/**
 * Server-derived Pre-Visit snapshot. Replaces verifyVitalsSnapshot.test.js: the old
 * sanitiser only checked the SHAPE of a client payload; the builder ignores the payload
 * entirely and reads the user's stored rows, so these tests assert the stronger property.
 */
import test from "node:test";
import assert from "node:assert/strict";

const prismaModule = await import("../lib/prisma.js");
const { buildSnapshotForUser, withServerDerivedSnapshot } =
  await import("../services/vitals/vitalsSnapshotBuilder.js");

const NOW = Date.parse("2026-07-26T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000);

function mockRows(rows) {
  prismaModule.prisma.vitalEntry = {
    findMany: async ({ where, orderBy, select }) => {
      assert.equal(where.userId, "u1", "ownership must be part of the query");
      assert.equal(where.deletedAt, null);
      assert.ok(Array.isArray(where.type.in), "type allow-list must be applied in SQL");
      assert.equal(orderBy.measuredAt, "desc", "must be ordered by measurement time");
      assert.equal(select.notes, undefined, "notes must not even be selected");
      assert.equal(select.externalId, undefined, "externalId must not be selected");
      return rows
        .filter((r) => r.measuredAt >= where.measuredAt.gte && r.measuredAt <= where.measuredAt.lte)
        .sort((a, b) => b.measuredAt - a.measuredAt);
    },
  };
}
const row = (o) => ({
  type: "weight", valuePrimary: 70, valueSecondary: null, unit: "kg",
  measuredAt: ago(1), source: "manual", sourceProvider: null, sourceDevice: null, ...o,
});

test("newest reading per type wins", async () => {
  mockRows([
    row({ type: "weight", valuePrimary: 70, measuredAt: ago(5) }),
    row({ type: "weight", valuePrimary: 72, measuredAt: ago(1) }),
  ]);
  const s = await buildSnapshotForUser("u1", { now: NOW });
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].valuePrimary, 72);
});

test("readings outside the age window are excluded", async () => {
  mockRows([row({ measuredAt: ago(200) })]);
  assert.equal(await buildSnapshotForUser("u1", { now: NOW }), null);
});

test("future timestamps cannot appear", async () => {
  mockRows([row({ measuredAt: new Date(NOW + 86400000) })]);
  assert.equal(await buildSnapshotForUser("u1", { now: NOW }), null);
});

test("only safe fields are emitted — no notes, no ids, no raw metadata", async () => {
  mockRows([row({ source: "import", sourceProvider: "apple_health", sourceDevice: "apple_watch" })]);
  const s = await buildSnapshotForUser("u1", { now: NOW });
  assert.deepEqual(Object.keys(s.items[0]).sort(),
    ["measuredAt","source","sourceDevice","sourceProvider","type","unit","valuePrimary","valueSecondary"]);
});

test("an unknown sourceDevice is dropped, never shown", async () => {
  mockRows([row({ source: "import", sourceProvider: "apple_health", sourceDevice: "BÖSARTIG" })]);
  const s = await buildSnapshotForUser("u1", { now: NOW });
  assert.equal(s.items[0].sourceDevice, null);
});

test("manual readings never carry a provider", async () => {
  mockRows([row({ source: "manual", sourceProvider: "apple_health" })]);
  const s = await buildSnapshotForUser("u1", { now: NOW });
  assert.equal(s.items[0].sourceProvider, null);
});

test("client-supplied values are discarded entirely", async () => {
  mockRows([row({ valuePrimary: 70 })]);
  const out = await withServerDerivedSnapshot({
    appointmentReason: "Kontrolle",
    vitalsSnapshot: { items: [{ type: "weight", valuePrimary: 999, notes: "GEHEIM" }] },
  }, "u1");
  assert.equal(out.appointmentReason, "Kontrolle", "other answers survive");
  assert.equal(out.vitalsSnapshot.items[0].valuePrimary, 70, "server value wins");
  assert.equal(JSON.stringify(out).includes("GEHEIM"), false);
});

test("no consent key → answers untouched, no snapshot added", async () => {
  mockRows([row({})]);
  const answers = { appointmentReason: "x" };
  assert.equal(await withServerDerivedSnapshot(answers, "u1"), answers);
});

test("consent given but nothing stored → key removed, not left as junk", async () => {
  mockRows([]);
  const out = await withServerDerivedSnapshot({ a: 1, vitalsSnapshot: { items: [] } }, "u1");
  assert.equal("vitalsSnapshot" in out, false);
});

test("a DB failure yields null instead of throwing into the request", async () => {
  prismaModule.prisma.vitalEntry = { findMany: async () => { throw new Error("db down"); } };
  assert.equal(await buildSnapshotForUser("u1", { now: NOW }), null);
});

test("missing user id is refused", async () => {
  assert.equal(await buildSnapshotForUser("", { now: NOW }), null);
  assert.equal(await buildSnapshotForUser(null, { now: NOW }), null);
});
