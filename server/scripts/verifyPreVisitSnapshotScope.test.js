/**
 * A Pre-Visit vitals snapshot must not carry another practice's readings.
 *
 * This was the last remaining cross-context path: the patient attaches their
 * measurements to a Pre-Visit form for practice A, and the snapshot was built
 * from ALL of their readings — including ones recorded inside the care
 * relationship with practice B. The practice read paths were already scoped;
 * this one was not.
 *
 * No database: Prisma is replaced by an in-memory adapter that evaluates the
 * generated `where` the way Prisma would.
 *
 * Run: node --test scripts/verifyPreVisitSnapshotScope.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma.js";
import { buildSnapshotForUser } from "../services/vitals/vitalsSnapshotBuilder.js";

const P = "user-P";
const PR = { A: "practice-A", B: "practice-B", C: "practice-C" };
const LINK = { A: "link-A", B: "link-B", C: "link-C" };

let links;
let rows;

/** Marker values so a leak is unmistakable. */
const MARK = { GLOBAL: 111, A: 222, B: 333, C: 444, LEGACY: 555 };

function seed() {
  const base = (id, value, scope, ctx) => ({
    id, userId: P, type: "heart_rate", valuePrimary: value, valueSecondary: null,
    unit: "bpm", measuredAt: new Date(Date.now() - 3600_000), deletedAt: null,
    source: "manual", sourceProvider: null, sourceDevice: null,
    dataScope: scope, contextPracticePatientLinkId: ctx,
  });
  return [
    base("g", MARK.GLOBAL, "patient_global", null),
    base("a", MARK.A, "practice_contextual", LINK.A),
    base("b", MARK.B, "practice_contextual", LINK.B),
    base("c", MARK.C, "practice_contextual", LINK.C),
    base("legacy", MARK.LEGACY, null, null),
  ];
}

/** Evaluates the subset of Prisma `where` this builder produces. */
function matches(row, where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR") {
      if (!v.some((branch) => matches(row, branch))) return false;
      continue;
    }
    if (k === "measuredAt") {
      const t = row.measuredAt.getTime();
      if (v.gte && t < v.gte.getTime()) return false;
      if (v.lte && t > v.lte.getTime()) return false;
      continue;
    }
    if (k === "type" && v?.in) {
      if (!v.in.includes(row.type)) return false;
      continue;
    }
    if (v === null) {
      if (row[k] !== null && row[k] !== undefined) return false;
      continue;
    }
    if (row[k] !== v) return false;
  }
  return true;
}

function installFake() {
  links = [
    { id: LINK.A, practiceProfileId: PR.A, patientUserId: P, status: "active" },
    { id: LINK.B, practiceProfileId: PR.B, patientUserId: P, status: "active" },
    { id: LINK.C, practiceProfileId: PR.C, patientUserId: P, status: "revoked" },
  ];
  rows = seed();

  prisma.practicePatientLink = {
    findFirst: async ({ where }) =>
      links.find((l) =>
        l.practiceProfileId === where.practiceProfileId &&
        l.patientUserId === where.patientUserId &&
        where.status.in.includes(l.status)) ?? null,
  };
  prisma.vitalEntry = {
    findMany: async ({ where, take }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.sort((x, y) => y.measuredAt - x.measuredAt);
      return typeof take === "number" ? hit.slice(0, take) : hit;
    },
  };
}

test.beforeEach(() => installFake());

const values = (snapshot) => (snapshot?.items ?? []).map((i) => i.valuePrimary);

test("1. a snapshot for practice A carries global and A's own readings", async () => {
  // Only the newest per type survives, so each case is checked by removing the
  // competitors — the point is which rows the QUERY admits.
  rows = rows.filter((r) => ["g", "a"].includes(r.id));
  const snap = await buildSnapshotForUser(P, { practiceProfileId: PR.A });
  assert.ok(snap, "a snapshot should exist");
  assert.equal(snap.items.length, 1);
});

test("2. practice B's readings never reach a snapshot for practice A", async () => {
  rows = rows.filter((r) => r.id === "b");
  const snap = await buildSnapshotForUser(P, { practiceProfileId: PR.A });
  assert.equal(snap, null, "B's contextual reading must not be visible to A");
});

test("3. practice A's readings never reach a snapshot for practice B", async () => {
  rows = rows.filter((r) => r.id === "a");
  const snap = await buildSnapshotForUser(P, { practiceProfileId: PR.B });
  assert.equal(snap, null);
});

test("4. only this practice's context matches, across all three practices", async () => {
  for (const [practice, allowed, forbidden] of [
    [PR.A, MARK.A, [MARK.B, MARK.C]],
    [PR.B, MARK.B, [MARK.A, MARK.C]],
  ]) {
    rows = seed().filter((r) => r.dataScope === "practice_contextual");
    const snap = await buildSnapshotForUser(P, { practiceProfileId: practice });
    const got = values(snap);
    assert.deepEqual(got, [allowed], `practice ${practice} saw ${got}`);
    for (const bad of forbidden) assert.ok(!got.includes(bad));
  }
});

test("5. global readings are always included", async () => {
  rows = rows.filter((r) => r.id === "g");
  for (const practice of [PR.A, PR.B, null]) {
    const snap = await buildSnapshotForUser(P, { practiceProfileId: practice });
    assert.deepEqual(values(snap), [MARK.GLOBAL], `practice ${practice}`);
  }
});

test("6. without a practice context the snapshot is global only", async () => {
  const snap = await buildSnapshotForUser(P, { practiceProfileId: null });
  assert.deepEqual(values(snap), [MARK.GLOBAL]);
  for (const missing of [undefined, "", "   "]) {
    const s = await buildSnapshotForUser(P, { practiceProfileId: missing });
    assert.deepEqual(values(s), [MARK.GLOBAL], `practiceProfileId=${JSON.stringify(missing)}`);
  }
});

test("7. a practice the patient has no active link to gets global only", async () => {
  // Practice C's link is revoked, so its contextual reading is out of reach.
  const snap = await buildSnapshotForUser(P, { practiceProfileId: PR.C });
  assert.deepEqual(values(snap), [MARK.GLOBAL]);
  const unknown = await buildSnapshotForUser(P, { practiceProfileId: "practice-nope" });
  assert.deepEqual(values(unknown), [MARK.GLOBAL]);
});

test("8. unclassified legacy readings never travel to a practice", async () => {
  rows = rows.filter((r) => r.id === "legacy");
  for (const practice of [PR.A, PR.B, null]) {
    const snap = await buildSnapshotForUser(P, { practiceProfileId: practice });
    assert.equal(snap, null, `legacy reading leaked to ${practice}`);
  }
});

test("9. a failed link lookup narrows, it never widens", async () => {
  prisma.practicePatientLink.findFirst = async () => { throw new Error("db down"); };
  rows = seed().filter((r) => r.dataScope === "practice_contextual");
  const snap = await buildSnapshotForUser(P, { practiceProfileId: PR.A });
  assert.equal(snap, null, "an error must not fall back to an unscoped query");
});

test("10. the practice is never inferred from a date or a specialty", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(
    new URL("../services/vitals/vitalsSnapshotBuilder.js", import.meta.url), "utf8",
  )
    // Strip every comment form, including single-line /** … */ — an assertion
    // must never be satisfied or broken by prose.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  assert.doesNotMatch(src, /specialty|appointment/i);
  // The link is looked up by practice and patient, and by nothing else.
  assert.match(src, /where: \{ practiceProfileId: pid, patientUserId: userId, status: \{ in: LINK_USABLE \} \}/);
});

test("11. the caller resolves the practice before building the snapshot", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../routes/previsitSessions.js", import.meta.url), "utf8");
  // Both call sites must pass a practice; an unscoped call would silently
  // restore the leak.
  const calls = [...src.matchAll(/withServerDerivedSnapshot\(([\s\S]*?)\);/g)].map((m) => m[1]);
  assert.equal(calls.length, 2, "expected exactly the create and patch call sites");
  for (const call of calls) {
    assert.match(call, /practiceProfileId/, "a snapshot must never be built without a practice argument");
  }
});
