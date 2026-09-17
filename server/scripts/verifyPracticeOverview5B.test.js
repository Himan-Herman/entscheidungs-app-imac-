/**
 * Phase 5B — finding and organising existing work, without widening anything.
 *
 * The overview is COMPUTED from the tables Phase 5A and the messaging phases
 * already own; nothing new is persisted. These tests hold the three properties
 * that an aggregation is most likely to break:
 *
 *   1. a count must never reach across a practice or across a link,
 *   2. a count is a statement that data EXISTS, so it must be gated by the same
 *      permission as the data itself, and
 *   3. "open work" must come from explicit product state, never from text.
 *
 * Run: node --test scripts/verifyPracticeOverview5B.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { searchPracticePatients } from "../services/careRelationship/practicePatientSearchService.js";
import { enrichPracticePatientLinks } from "../services/careRelationship/practicePatientRecordService.js";
import { linkToJson } from "../services/careRelationship/practicePatientLinkService.js";
import { createInternalNote } from "../services/practiceInternalWork/internalNoteService.js";
import {
  completeReminder,
  createReminder,
} from "../services/practiceInternalWork/reminderService.js";
import { PERMISSIONS, hasPracticePermission } from "../utils/practicePermissions.js";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/** Practice A with two links to one patient, plus practice B with its own. */
async function buildWorld(t) {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const mk = (tag, first) =>
    prisma.user.create({
      data: {
        email: `ov-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: first,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const [ownerA, ownerB, patient] = await Promise.all([
    mk("oa", "Owner"), mk("ob", "Fremd"), mk("p", "Mia"),
  ]);
  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "PraxisA", publicSlug: `ova-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "PraxisB", publicSlug: `ovb-${stamp}`, isActive: true },
  });
  // The second relationship of the SAME practice is a second patient profile.
  const relative = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Mia Junior", relationLabel: "child" },
  });
  const link = (pid, profileId = null) =>
    prisma.practicePatientLink.create({
      data: { practiceProfileId: pid, patientUserId: patient.id, patientProfileId: profileId, status: "active" },
    });
  const [a1, a2, b1] = await Promise.all([
    link(practiceA.id), link(practiceA.id, relative.id), link(practiceB.id),
  ]);

  t.after(() => prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } }));
  return { practiceA, practiceB, ownerA, ownerB, patient, a1, a2, b1, stamp };
}

const ALL = { includeReminders: true, includeInternalNotes: true };
const scope = (w, link, owner) => ({
  linkId: link.id, practiceProfileId: link.practiceProfileId, actorUserId: owner.id,
});
const summaryFor = async (practiceId, linkId, visibility = ALL) => {
  const res = await searchPracticePatients(practiceId, {}, visibility);
  return res.links.find((l) => l.id === linkId)?.summary ?? null;
};

/* ═══════════════════════════════════════════════ counters stay in their lane */

test("an open-reminder count never reaches across practices", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w, w.b1, w.ownerB), title: "B", dueAt: "2026-09-01T09:00:00.000Z" });

  // Practice A has none of its own, and must not inherit B's.
  const a1 = await summaryFor(w.practiceA.id, w.a1.id);
  assert.equal(a1.openReminderCount, 0);

  const b1 = await summaryFor(w.practiceB.id, w.b1.id);
  assert.equal(b1.openReminderCount, 1);
});

test("counts are per LINK, not per practice and not per patient", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w, w.a1, w.ownerA), title: "A1", dueAt: "2026-09-01T09:00:00.000Z" });
  await createInternalNote({ ...scope(w, w.a1, w.ownerA), body: "nur A1" });

  const a1 = await summaryFor(w.practiceA.id, w.a1.id);
  const a2 = await summaryFor(w.practiceA.id, w.a2.id);

  assert.equal(a1.openReminderCount, 1);
  assert.equal(a1.internalNoteCount, 1);
  // Same practice, same person, second relationship — its own, empty tally.
  assert.equal(a2.openReminderCount, 0);
  assert.equal(a2.internalNoteCount, 0);
});

test("a completed follow-up stops counting as open", { skip }, async (t) => {
  const w = await buildWorld(t);
  const r = await createReminder({
    ...scope(w, w.a1, w.ownerA), title: "erst offen", dueAt: "2026-09-01T09:00:00.000Z",
  });
  assert.equal((await summaryFor(w.practiceA.id, w.a1.id)).openReminderCount, 1);

  await completeReminder({
    reminderId: r.id, linkId: w.a1.id, practiceProfileId: w.practiceA.id, actorUserId: w.ownerA.id,
  });
  assert.equal((await summaryFor(w.practiceA.id, w.a1.id)).openReminderCount, 0);
});

/* ══════════════════════════════════════════════════ §12 no existence leaks */

test("a caller without the permission is told nothing, not zero", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w, w.a1, w.ownerA), title: "geheim", dueAt: "2026-09-01T09:00:00.000Z" });
  await createInternalNote({ ...scope(w, w.a1, w.ownerA), body: "geheim" });

  const blind = await summaryFor(w.practiceA.id, w.a1.id, {});
  // Absent keys, not zeros: a zero would still confirm the feature applies here.
  assert.ok(!("openReminderCount" in blind), "no reminder counter without reminders.read");
  assert.ok(!("internalNoteCount" in blind), "no note counter without internal_notes.read");
  assert.ok(!("lastInternalNoteAt" in blind));
  // The rest of the row is unaffected.
  assert.equal(typeof blind.unreadMessageCount, "number");
});

test("the two permissions are independent of each other", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w, w.a1, w.ownerA), title: "r", dueAt: "2026-09-01T09:00:00.000Z" });
  await createInternalNote({ ...scope(w, w.a1, w.ownerA), body: "n" });

  const onlyReminders = await summaryFor(w.practiceA.id, w.a1.id, { includeReminders: true });
  assert.equal(onlyReminders.openReminderCount, 1);
  assert.ok(!("internalNoteCount" in onlyReminders));

  const onlyNotes = await summaryFor(w.practiceA.id, w.a1.id, { includeInternalNotes: true });
  assert.equal(onlyNotes.internalNoteCount, 1);
  assert.ok(!("openReminderCount" in onlyNotes));
});

test("viewer holds neither permission, so the overview tells it nothing", () => {
  assert.equal(hasPracticePermission("viewer", PERMISSIONS.REMINDERS_READ), false);
  assert.equal(hasPracticePermission("viewer", PERMISSIONS.INTERNAL_NOTES_READ), false);
  // ...while a working role does.
  assert.equal(hasPracticePermission("assistant", PERMISSIONS.REMINDERS_READ), true);
});

/* ═════════════════════════════════════════════════════════ §5/§6 the filter */

test("the open-follow-up filter selects relationships, not practices", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w, w.a2, w.ownerA), title: "nur A2", dueAt: "2026-09-01T09:00:00.000Z" });
  await createReminder({ ...scope(w, w.b1, w.ownerB), title: "nur B", dueAt: "2026-09-01T09:00:00.000Z" });

  const openInA = await searchPracticePatients(w.practiceA.id, { hasOpenReminders: "true" }, ALL);
  assert.deepEqual(openInA.links.map((l) => l.id), [w.a2.id], "only A2, and never B's link");

  const noneInA = await searchPracticePatients(w.practiceA.id, { hasOpenReminders: "false" }, ALL);
  assert.ok(noneInA.links.some((l) => l.id === w.a1.id));
  assert.ok(!noneInA.links.some((l) => l.id === w.a2.id));
  assert.ok(!noneInA.links.some((l) => l.id === w.b1.id));
});

test("a completed follow-up drops out of the open filter", { skip }, async (t) => {
  const w = await buildWorld(t);
  const r = await createReminder({
    ...scope(w, w.a1, w.ownerA), title: "wird erledigt", dueAt: "2026-09-01T09:00:00.000Z",
  });
  let open = await searchPracticePatients(w.practiceA.id, { hasOpenReminders: "true" }, ALL);
  assert.deepEqual(open.links.map((l) => l.id), [w.a1.id]);

  await completeReminder({
    reminderId: r.id, linkId: w.a1.id, practiceProfileId: w.practiceA.id, actorUserId: w.ownerA.id,
  });
  open = await searchPracticePatients(w.practiceA.id, { hasOpenReminders: "true" }, ALL);
  assert.deepEqual(open.links.map((l) => l.id), []);
});

/* ═════════════════════════════════════════════════ §4/§10 what is NOT shown */

test("no note body and no reminder title reaches the overview payload", { skip }, async (t) => {
  const w = await buildWorld(t);
  const secret = `GEHEIMER_TEXT_${w.stamp}`;
  await createInternalNote({ ...scope(w, w.a1, w.ownerA), body: secret });
  await createReminder({ ...scope(w, w.a1, w.ownerA), title: secret, dueAt: "2026-09-01T09:00:00.000Z" });

  const res = await searchPracticePatients(w.practiceA.id, {}, ALL);
  assert.ok(!JSON.stringify(res).includes(secret), "the list carries counts, never content");
});

test("searching does not read note or reminder text", { skip }, async (t) => {
  const w = await buildWorld(t);
  const needle = `NADEL${w.stamp}`;
  await createInternalNote({ ...scope(w, w.a1, w.ownerA), body: `enthält ${needle}` });
  await createReminder({ ...scope(w, w.a1, w.ownerA), title: `enthält ${needle}`, dueAt: "2026-09-01T09:00:00.000Z" });

  // Searching for text that exists ONLY inside internal content must not match:
  // the search is over patient metadata, deliberately not over bodies.
  const res = await searchPracticePatients(w.practiceA.id, { q: needle }, ALL);
  assert.deepEqual(res.links.map((l) => l.id), []);
});

/* ═════════════════════════════════════════════ §17 aggregation stays grouped */

test("the query count does not grow with the number of relationships", { skip }, async (t) => {
  const w = await buildWorld(t);

  /*
   * The property that matters is not speed, it is SHAPE: one grouped query per
   * fact, never one per link. Counting round-trips at two different sizes says
   * that directly, and a future refactor into a per-link loop fails here even
   * on a fast machine.
   */
  const roundTrips = async (fn) => {
    let calls = 0;
    const patched = [];
    for (const model of ["practicePatientLink", "practiceDocument", "practicePatientThread",
                         "practicePatientMessage", "preVisitSession", "medicationPlan",
                         "patientDataRequest", "practicePatientReminder",
                         "practicePatientInternalNote", "user"]) {
      for (const op of ["findMany", "groupBy", "count", "findFirst"]) {
        if (typeof prisma[model]?.[op] !== "function") continue;
        const orig = prisma[model][op].bind(prisma[model]);
        patched.push([model, op, prisma[model][op]]);
        prisma[model][op] = async (...args) => { calls += 1; return orig(...args); };
      }
    }
    try {
      await fn();
    } finally {
      for (const [model, op, orig] of patched) prisma[model][op] = orig;
    }
    return calls;
  };

  // Two relationships…
  const small = await roundTrips(() => searchPracticePatients(w.practiceA.id, {}, ALL));

  // …then twelve more on the same practice.
  for (let i = 0; i < 12; i += 1) {
    const p = await prisma.user.create({
      data: {
        email: `ovbulk-${i}-${w.stamp}@test.invalid`, passwordHash: "x",
        firstName: `Bulk${i}`, lastName: "Test",
        dateOfBirth: new Date("1980-01-01"), verified: true,
      },
    });
    const link = await prisma.practicePatientLink.create({
      data: { practiceProfileId: w.practiceA.id, patientUserId: p.id, status: "active" },
    });
    await createInternalNote({ linkId: link.id, practiceProfileId: w.practiceA.id,
                               actorUserId: w.ownerA.id, body: `bulk ${i}` });
    await createReminder({ linkId: link.id, practiceProfileId: w.practiceA.id,
                           actorUserId: w.ownerA.id, title: `bulk ${i}`,
                           dueAt: "2026-09-01T09:00:00.000Z" });
  }
  t.after(() => prisma.user.deleteMany({ where: { email: { contains: `ovbulk-` } } }));

  const large = await roundTrips(() => searchPracticePatients(w.practiceA.id, {}, ALL));
  const listed = (await searchPracticePatients(w.practiceA.id, {}, ALL)).total;

  assert.ok(listed >= 14, `the practice should now hold ${listed} relationships`);
  assert.equal(large, small, `round-trips must not grow with links (${small} → ${large})`);
});

test("a forbidden counter costs no query either", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w, w.a1, w.ownerA), title: "r", dueAt: "2026-09-01T09:00:00.000Z" });

  const count = async (visibility) => {
    let calls = 0;
    const orig = { r: prisma.practicePatientReminder.groupBy.bind(prisma.practicePatientReminder),
                   n: prisma.practicePatientInternalNote.groupBy.bind(prisma.practicePatientInternalNote) };
    prisma.practicePatientReminder.groupBy = async (...a) => { calls += 1; return orig.r(...a); };
    prisma.practicePatientInternalNote.groupBy = async (...a) => { calls += 1; return orig.n(...a); };
    try { await searchPracticePatients(w.practiceA.id, {}, visibility); }
    finally {
      prisma.practicePatientReminder.groupBy = orig.r;
      prisma.practicePatientInternalNote.groupBy = orig.n;
    }
    return calls;
  };

  assert.equal(await count(ALL), 2, "both grouped queries run when permitted");
  assert.equal(await count({}), 0, "and neither runs when the caller may not see them");
});

/* ═════════════════════════════════════════════════════ §11/§29 patient side */

test("no patient-facing module imports the overview aggregation", async () => {
  const { readFile } = await import("node:fs/promises");
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const file of ["../routes/patientThreads.js", "../routes/account.js",
                      "../services/export/exportJobService.js"]) {
    let src;
    try { src = strip(await readFile(new URL(file, import.meta.url), "utf8")); } catch { continue; }
    assert.ok(!src.includes("searchPracticePatients"), `${file} must not aggregate practice work`);
    assert.ok(!src.includes("enrichPracticePatientLinks"), `${file} must not aggregate practice work`);
  }
});

/* ════════════════════════════════════════════ §4/§15/§16 search behaviour */

test("search matches the patient, and only inside this practice", { skip }, async (t) => {
  const w = await buildWorld(t);
  const own = await searchPracticePatients(w.practiceA.id, { q: "Mia" }, ALL);
  assert.ok(own.links.length >= 1, "the practice finds its own patient");
  assert.ok(own.links.every((l) => l.practiceProfileId === w.practiceA.id));
  assert.ok(!own.links.some((l) => l.id === w.b1.id), "never another practice's relationship");

  // The same person is reachable from practice B — through B's own link only.
  const other = await searchPracticePatients(w.practiceB.id, { q: "Mia" }, ALL);
  assert.deepEqual(other.links.map((l) => l.id), [w.b1.id]);
});

test("both relationships of one practice survive the search, told apart by profile", { skip }, async (t) => {
  const w = await buildWorld(t);
  const res = await searchPracticePatients(w.practiceA.id, { q: "Mia" }, ALL);
  const ids = res.links.map((l) => l.id).sort();
  assert.deepEqual(ids, [w.a1.id, w.a2.id].sort(), "a search must not collapse them into one patient");
  assert.equal(
    res.links.find((l) => l.id === w.a2.id).patientProfile.displayName,
    "Mia Junior",
  );
  assert.equal(res.links.find((l) => l.id === w.a1.id).patientProfile, null);
});

test("an empty query lists everything; a nonsense query lists nothing", { skip }, async (t) => {
  const w = await buildWorld(t);
  assert.equal((await searchPracticePatients(w.practiceA.id, { q: "" }, ALL)).total, 2);
  assert.equal((await searchPracticePatients(w.practiceA.id, { q: "   " }, ALL)).total, 2);
  assert.equal((await searchPracticePatients(w.practiceA.id, { q: "zzzz-kein-treffer" }, ALL)).total, 0);
});

test("special characters are data, not syntax", { skip }, async (t) => {
  const w = await buildWorld(t);
  // Wildcards, quotes and regex metacharacters must find nothing rather than
  // match everything or blow up the query.
  for (const q of ["%", "_", "%%", "'", '"', "\\", "100%", "a' OR '1'='1", "*", ".*", "()[]"]) {
    const res = await searchPracticePatients(w.practiceA.id, { q }, ALL);
    assert.ok(Array.isArray(res.links), `query ${JSON.stringify(q)} must not throw`);
    assert.equal(res.total, 0, `query ${JSON.stringify(q)} must not match every row`);
  }
});

test("ordering is deterministic across identical calls", { skip }, async (t) => {
  const w = await buildWorld(t);
  const runs = await Promise.all(
    Array.from({ length: 4 }, () => searchPracticePatients(w.practiceA.id, {}, ALL)),
  );
  const first = runs[0].links.map((l) => l.id);
  for (const r of runs.slice(1)) {
    assert.deepEqual(r.links.map((l) => l.id), first, "the same request must return the same order");
  }
});

test("pagination splits the set without losing or repeating a relationship", { skip }, async (t) => {
  const w = await buildWorld(t);
  const p1 = await searchPracticePatients(w.practiceA.id, { page: "1", limit: "1" }, ALL);
  const p2 = await searchPracticePatients(w.practiceA.id, { page: "2", limit: "1" }, ALL);

  assert.equal(p1.links.length, 1);
  assert.equal(p2.links.length, 1);
  assert.equal(p1.hasMore, true);
  assert.equal(p2.hasMore, false);
  assert.notEqual(p1.links[0].id, p2.links[0].id, "page two must not repeat page one");
  assert.deepEqual(
    [p1.links[0].id, p2.links[0].id].sort(),
    [w.a1.id, w.a2.id].sort(),
    "together the pages are the whole set",
  );
});
