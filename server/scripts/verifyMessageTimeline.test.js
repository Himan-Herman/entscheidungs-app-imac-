/**
 * Per-message read state and cursor pagination (Phase 3A).
 *
 * The read model did not have to be built: `PracticePatientMessage.readAt` was
 * already per message, and no thread-level read column ever existed. What was
 * missing is a BOUNDARY — the acknowledgement marked every unread incoming
 * message in the thread, which is indistinguishable from a thread-level state
 * and loses a message that arrives while the request is in flight.
 *
 * The second theme is order. `createdAt` alone is not a total order: two
 * messages can share a timestamp, and then "the next page" and "everything up
 * to here" are both ambiguous. The id breaks the tie, and the SAME order is
 * used by the timeline, the cursor and the boundary.
 *
 * Runs against the REAL database — an ordering claim that only holds in a fake
 * is worth nothing. Skips when none is reachable.
 *
 * Run: node --test scripts/verifyMessageTimeline.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma.js";
import {
  archiveThreadForPatient,
  getChannelForPatientLink,
  listThreadMessagesPage,
  markThreadRead,
  restoreThreadForPatient,
} from "../services/communication/practicePatientThreadService.js";

const SUFFIX = "timeline@test.invalid";

let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/** Patient P with link A and link A2 (same practice), plus patient Q. */
async function buildFixture() {
  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `${tag}-${Date.now()}-${Math.round(Math.random() * 1e6)}-${SUFFIX}`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const patient = await mk("p");
  const other = await mk("q");
  const owner = await mk("o");

  const practice = await prisma.practiceProfile.create({
    data: {
      userId: owner.id,
      practiceName: "PraxisTimeline",
      publicSlug: `tl-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    },
  });

  const profile = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Angehoerige", relationLabel: "child" },
  });

  const link = (pat, profileId = null) =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: practice.id,
        patientUserId: pat.id,
        patientProfileId: profileId,
        status: "active",
        consentScopes: ["secure_messaging"],
        consentAcceptedAt: new Date(),
      },
    });
  const linkA = await link(patient);
  const linkA2 = await link(patient, profile.id);
  const linkQ = await link(other);

  const thread = (l) =>
    prisma.practicePatientThread.create({
      data: {
        practicePatientLinkId: l.id,
        practiceProfileId: practice.id,
        patientUserId: l.patientUserId,
        status: "open",
      },
    });
  const threadA = await thread(linkA);
  const threadA2 = await thread(linkA2);
  const threadQ = await thread(linkQ);

  /** Messages with EXPLICIT timestamps, so collisions can be forced. */
  const say = (t, senderType, body, at) =>
    prisma.practicePatientMessage.create({
      data: {
        threadId: t.id,
        senderType,
        senderUserId: senderType === "practice" ? owner.id : t.patientUserId,
        body,
        createdAt: at ?? new Date(),
      },
    });

  return { patient, other, owner, practice, linkA, linkA2, linkQ, threadA, threadA2, threadQ, say };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

const bodies = (page) => page.messages.map((m) => m.body);

/* ============================================== Per-message read boundary */

test("acknowledging through one message leaves later ones unread", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = Date.now();
  const m1 = await f.say(f.threadA, "practice", "M1", new Date(base));
  const m2 = await f.say(f.threadA, "practice", "M2", new Date(base + 1000));

  await markThreadRead(f.threadA.id, "patient", {
    patientUserId: f.patient.id,
    throughMessageId: m1.id,
  });

  const after = await prisma.practicePatientMessage.findMany({
    where: { threadId: f.threadA.id },
    orderBy: { createdAt: "asc" },
  });
  assert.ok(after.find((m) => m.id === m1.id).readAt, "M1 is read");
  assert.equal(after.find((m) => m.id === m2.id).readAt, null, "M2 was never displayed");
});

test("a message arriving after the boundary stays unread", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // The race this exists for: the client renders M1..M10, and M11 lands while
  // the acknowledgement is in flight.
  const base = Date.now();
  const sent = [];
  for (let i = 1; i <= 10; i += 1) {
    sent.push(await f.say(f.threadA, "practice", `M${i}`, new Date(base + i * 1000)));
  }
  const m11 = await f.say(f.threadA, "practice", "M11", new Date(base + 11_000));

  await markThreadRead(f.threadA.id, "patient", {
    patientUserId: f.patient.id,
    throughMessageId: sent[9].id,
  });

  const fresh = await prisma.practicePatientMessage.findMany({ where: { threadId: f.threadA.id } });
  assert.equal(fresh.filter((m) => m.readAt).length, 10, "exactly the ten that were displayed");
  assert.equal(fresh.find((m) => m.id === m11.id).readAt, null, "and not the one that arrived after");
});

test("a reader never acknowledges their own messages", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = Date.now();
  const mine = await f.say(f.threadA, "patient", "MINE", new Date(base));
  const theirs = await f.say(f.threadA, "practice", "THEIRS", new Date(base + 1000));

  await markThreadRead(f.threadA.id, "patient", {
    patientUserId: f.patient.id,
    throughMessageId: theirs.id,
  });

  const rows = await prisma.practicePatientMessage.findMany({ where: { threadId: f.threadA.id } });
  assert.equal(rows.find((m) => m.id === mine.id).readAt, null, "reading your own text is not a receipt");
  assert.ok(rows.find((m) => m.id === theirs.id).readAt);
});

test("a boundary from another conversation moves nothing", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const mine = await f.say(f.threadA, "practice", "A1");
  const foreign = await f.say(f.threadA2, "practice", "A2_1");

  await assert.rejects(
    () =>
      markThreadRead(f.threadA.id, "patient", {
        patientUserId: f.patient.id,
        throughMessageId: foreign.id,
      }),
    /message_not_in_thread/,
    "silently ignoring it would turn a foreign id into a whole-thread acknowledgement",
  );

  const rows = await prisma.practicePatientMessage.findMany({ where: { threadId: f.threadA.id } });
  assert.equal(rows.find((m) => m.id === mine.id).readAt, null, "nothing was marked");
});

test("a second link to the same practice cannot move this one's read state", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  assert.equal(f.linkA.practiceProfileId, f.linkA2.practiceProfileId, "precondition");
  const inA = await f.say(f.threadA, "practice", "A_MSG");

  await markThreadRead(f.threadA2.id, "patient", { patientUserId: f.patient.id });

  const row = await prisma.practicePatientMessage.findUnique({ where: { id: inA.id } });
  assert.equal(row.readAt, null, "acknowledging one relationship must not touch the other");
});

test("another patient cannot acknowledge this conversation", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const msg = await f.say(f.threadA, "practice", "A_MSG");
  await assert.rejects(
    () => markThreadRead(f.threadA.id, "patient", { patientUserId: f.other.id }),
    /thread_not_found/,
  );
  const row = await prisma.practicePatientMessage.findUnique({ where: { id: msg.id } });
  assert.equal(row.readAt, null);
});

test("acknowledging twice keeps the first timestamp", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const msg = await f.say(f.threadA, "practice", "ONCE");
  await markThreadRead(f.threadA.id, "patient", {
    patientUserId: f.patient.id,
    throughMessageId: msg.id,
  });
  const first = (await prisma.practicePatientMessage.findUnique({ where: { id: msg.id } })).readAt;

  await markThreadRead(f.threadA.id, "patient", {
    patientUserId: f.patient.id,
    throughMessageId: msg.id,
  });
  const second = (await prisma.practicePatientMessage.findUnique({ where: { id: msg.id } })).readAt;

  assert.deepEqual(second, first, "a retry must not restate when it was read");
});

/* ==================================================== GET has no side effect */

test("reading the timeline never marks anything read", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  await f.say(f.threadA, "practice", "UNREAD_1");
  await f.say(f.threadA, "practice", "UNREAD_2");

  await getChannelForPatientLink(f.linkA.id, f.patient.id);
  await listThreadMessagesPage(f.threadA.id);
  await listThreadMessagesPage(f.threadA.id);

  const rows = await prisma.practicePatientMessage.findMany({ where: { threadId: f.threadA.id } });
  assert.equal(rows.filter((m) => m.readAt).length, 0, "acknowledgement stays explicit");
});

/* ================================================== Cursor pagination */

test("the newest page comes first and reports what is above it", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = Date.now();
  for (let i = 1; i <= 12; i += 1) {
    await f.say(f.threadA, "practice", `M${String(i).padStart(2, "0")}`, new Date(base + i * 1000));
  }

  const page = await listThreadMessagesPage(f.threadA.id, { limit: 5 });
  assert.deepEqual(bodies(page), ["M08", "M09", "M10", "M11", "M12"], "newest five, oldest-first");
  assert.equal(page.hasMore, true);
  assert.ok(page.olderCursor, "and it says where the next page starts");
});

test("paging back covers everything exactly once", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = Date.now();
  const total = 13;
  for (let i = 1; i <= total; i += 1) {
    await f.say(f.threadA, "practice", `M${String(i).padStart(2, "0")}`, new Date(base + i * 1000));
  }

  const seen = [];
  let cursor = null;
  let guard = 0;
  do {
    const page = await listThreadMessagesPage(f.threadA.id, { limit: 5, before: cursor });
    seen.unshift(...bodies(page));
    cursor = page.hasMore ? page.olderCursor : null;
    assert.ok(++guard < 10, "paging must terminate");
  } while (cursor);

  assert.equal(seen.length, total, "no gaps");
  assert.equal(new Set(seen).size, total, "no duplicates");
  assert.deepEqual(seen, [...seen].sort(), "and the order held across pages");
});

test("messages sharing a timestamp are not lost at a page boundary", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  // The case createdAt alone cannot express. All six are simultaneous, so only
  // the id decides — and a page boundary falls right in the middle of them.
  const at = new Date();
  for (let i = 1; i <= 6; i += 1) {
    await f.say(f.threadA, "practice", `SAME_${i}`, at);
  }

  const seen = [];
  let cursor = null;
  let guard = 0;
  do {
    const page = await listThreadMessagesPage(f.threadA.id, { limit: 2, before: cursor });
    seen.unshift(...bodies(page));
    cursor = page.hasMore ? page.olderCursor : null;
    assert.ok(++guard < 10, "paging must terminate");
  } while (cursor);

  assert.equal(seen.length, 6, "six identical timestamps, six messages");
  assert.equal(new Set(seen).size, 6, "none repeated");
});

test("the same total order is used for paging and for the boundary", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const at = new Date();
  for (let i = 1; i <= 6; i += 1) {
    await f.say(f.threadA, "practice", `SAME_${i}`, at);
  }

  // Acknowledge through whatever the timeline calls the third message.
  const all = await listThreadMessagesPage(f.threadA.id, { limit: 100 });
  const third = all.messages[2];
  await markThreadRead(f.threadA.id, "patient", {
    patientUserId: f.patient.id,
    throughMessageId: third.id,
  });

  const fresh = await listThreadMessagesPage(f.threadA.id, { limit: 100 });
  const readFlags = fresh.messages.map((m) => Boolean(m.readAt));
  assert.deepEqual(
    readFlags,
    [true, true, true, false, false, false],
    "if the two orders disagreed, the read prefix would not be contiguous",
  );
});

test("a cursor from another conversation is refused", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const foreign = await f.say(f.threadQ, "practice", "Q_MSG");
  await assert.rejects(
    () => listThreadMessagesPage(f.threadA.id, { before: foreign.id }),
    /message_not_in_thread/,
  );
});

test("the page size is bounded whatever the caller asks for", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = Date.now();
  for (let i = 1; i <= 8; i += 1) {
    await f.say(f.threadA, "practice", `M${i}`, new Date(base + i * 1000));
  }

  assert.equal((await listThreadMessagesPage(f.threadA.id, { limit: 5000 })).limit, 100);
  assert.equal((await listThreadMessagesPage(f.threadA.id, { limit: 0 })).limit, 50);
  assert.equal((await listThreadMessagesPage(f.threadA.id, { limit: -3 })).limit, 50);
});

/* ================================================= The initial timeline */

test("opening a long conversation does not load all of it", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = Date.now();
  for (let i = 1; i <= 60; i += 1) {
    await f.say(f.threadA, "practice", `M${String(i).padStart(3, "0")}`, new Date(base + i * 1000));
  }

  const { channel } = await getChannelForPatientLink(f.linkA.id, f.patient.id);
  assert.equal(channel.messages.length, 50, "the newest page only");
  assert.equal(channel.messages[49].body, "M060", "and it really is the newest end");
  assert.equal(channel.hasMoreMessages, true, "with history above it");
  assert.ok(channel.olderCursor);
  assert.equal(channel.messageCount, 60, "the total is still reported");
});

test("the whole conversation is still reachable through the cursor", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = Date.now();
  for (let i = 1; i <= 60; i += 1) {
    await f.say(f.threadA, "practice", `M${String(i).padStart(3, "0")}`, new Date(base + i * 1000));
  }

  const { channel } = await getChannelForPatientLink(f.linkA.id, f.patient.id);
  const older = await listThreadMessagesPage(f.threadA.id, { before: channel.olderCursor });

  assert.equal(older.messages.length, 10, "the remaining ten");
  assert.equal(older.messages[0].body, "M001");
  assert.equal(older.hasMore, false, "and nothing above them");
});

/* ============================================================ Performance */

test("a page costs a constant number of queries", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = Date.now();
  for (let i = 1; i <= 40; i += 1) {
    await f.say(f.threadA, "practice", `M${i}`, new Date(base + i * 1000));
  }

  const wrapped = [];
  const count = { n: 0 };
  for (const model of ["practicePatientMessage", "practicePatientThread"]) {
    for (const op of ["findFirst", "findMany", "findUnique", "count", "updateMany"]) {
      const original = prisma[model][op];
      if (typeof original !== "function") continue;
      wrapped.push([model, op, original]);
      prisma[model][op] = (...a) => {
        count.n += 1;
        return original.apply(prisma[model], a);
      };
    }
  }
  t.after(() => wrapped.forEach(([m, o, fn]) => { prisma[m][o] = fn; }));

  count.n = 0;
  await listThreadMessagesPage(f.threadA.id, { limit: 10 });
  const firstPage = count.n;

  count.n = 0;
  const page = await listThreadMessagesPage(f.threadA.id, { limit: 10 });
  await listThreadMessagesPage(f.threadA.id, { limit: 10, before: page.olderCursor });
  assert.ok(count.n <= firstPage + 3, `paging must not fan out, got ${count.n}`);

  // The acknowledgement is one bulk update, not one per message.
  count.n = 0;
  await markThreadRead(f.threadA.id, "patient", { patientUserId: f.patient.id });
  assert.ok(count.n <= 6, `acknowledgement must be bulk, got ${count.n} queries`);
});

test("the database is never asked for the whole conversation", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = Date.now();
  for (let i = 1; i <= 40; i += 1) {
    await f.say(f.threadA, "practice", `M${i}`, new Date(base + i * 1000));
  }

  // A behavioural test cannot see this: without a `take` the code still slices
  // the newest page in memory and returns exactly the same payload. The
  // difference is how many rows crossed the wire, so that is what is measured.
  const original = prisma.practicePatientMessage.findMany;
  const fetched = [];
  prisma.practicePatientMessage.findMany = async (...args) => {
    const rows = await original.apply(prisma.practicePatientMessage, args);
    fetched.push({ take: args[0]?.take, returned: rows.length });
    return rows;
  };
  t.after(() => { prisma.practicePatientMessage.findMany = original; });

  fetched.length = 0;
  await listThreadMessagesPage(f.threadA.id, { limit: 10 });
  for (const q of fetched) {
    assert.equal(typeof q.take, "number", "every timeline query must be bounded");
    assert.ok(q.returned <= 11, `a page query returned ${q.returned} rows`);
  }

  fetched.length = 0;
  await getChannelForPatientLink(f.linkA.id, f.patient.id);
  const messageQueries = fetched.filter((q) => typeof q.take === "number");
  assert.ok(messageQueries.length > 0, "opening the channel reads messages");
  for (const q of fetched) {
    assert.equal(typeof q.take, "number", "opening a conversation must be bounded too");
    assert.ok(q.returned <= 51, `the initial load returned ${q.returned} rows`);
  }

  // The same measurement on the other answer-carrying paths. Their payloads are
  // already checked elsewhere, but a payload cannot show how many rows were
  // read to produce it.
  for (const [name, act] of [
    ["acknowledging", () => markThreadRead(f.threadA.id, "patient", {
      linkId: f.linkA.id,
      patientUserId: f.patient.id,
    })],
    ["archiving", () => archiveThreadForPatient(f.threadA.id, f.patient.id)],
    ["restoring", () => restoreThreadForPatient(f.threadA.id, f.patient.id)],
  ]) {
    fetched.length = 0;
    await act();
    const reads = fetched.filter((q) => typeof q.take === "number");
    assert.ok(reads.length > 0, `${name} reads messages`);
    for (const q of fetched) {
      assert.equal(typeof q.take, "number", `${name} must be bounded too`);
      assert.ok(q.returned <= 51, `${name} read ${q.returned} rows`);
    }
  }
});

/*
 * The bound has to hold on EVERY response that carries a conversation, not only
 * on the one that opens it. Acknowledging and sending both answer with the
 * thread, and an unbounded answer there would hand over the whole history the
 * moment the reader does anything at all.
 */

/** A conversation longer than one page, in a fixed total order. */
async function seedLong(f, n = 60) {
  const base = new Date("2026-01-01T00:00:00.000Z").getTime();
  for (let i = 1; i <= n; i += 1) {
    await f.say(f.threadA, "practice", `m${String(i).padStart(3, "0")}`, new Date(base + i * 1000));
  }
  return n;
}

test("acknowledging answers with one page, not the whole history", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const n = await seedLong(f);

  const answer = await markThreadRead(f.threadA.id, "patient", {
    linkId: f.linkA.id,
    patientUserId: f.patient.id,
  });

  assert.ok(n > 50, "the fixture must be longer than one page");
  assert.equal(answer.messages.length, 50);
  assert.equal(answer.hasMoreMessages, true);
  assert.ok(answer.olderCursor, "the answer must say where the rest continues");
  // The page it returns is the NEWEST one, in the same ascending order.
  assert.equal(bodies(answer).at(-1), `m${String(n).padStart(3, "0")}`);
  assert.deepEqual(bodies(answer), [...bodies(answer)].sort());
});

test("a patient's own view actions answer with one page too", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  await seedLong(f);

  // Archiving and restoring are view preferences, but they answer with the
  // thread all the same — so they are answer-carrying paths and bound by the
  // same rule.
  for (const act of [archiveThreadForPatient, restoreThreadForPatient]) {
    const answer = await act(f.threadA.id, f.patient.id);
    assert.equal(answer.messages.length, 50, `${act.name} answered unbounded`);
    assert.equal(answer.hasMoreMessages, true);
    assert.deepEqual(bodies(answer), [...bodies(answer)].sort());
  }
});

test("no path in the service loads a whole conversation", { skip: false }, async () => {
  const src = await readFile(
    new URL("../services/communication/practicePatientThreadService.js", import.meta.url),
    "utf8",
  );
  // `take: 1` list previews are fine — they are a preview, not a timeline.
  const unbounded = src
    .split("\n")
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => /messages:\s*\{\s*orderBy/.test(line) && !/take:/.test(line));

  assert.deepEqual(
    unbounded,
    [],
    `these lines load a conversation without a bound: ${unbounded.map(([i]) => i).join(", ")}`,
  );
  // The guard must be able to fail: prove the pattern it looks for is real.
  assert.ok(/messages:\s*\{\s*orderBy/.test(src), "the guard matches nothing — it has gone stale");
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});
