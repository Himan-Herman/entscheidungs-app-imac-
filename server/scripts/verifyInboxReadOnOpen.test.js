/**
 * Phase 7 hotfix — opening a notice marks it read, and the count follows.
 *
 * ── The bug ─────────────────────────────────────────────────────────────────
 * A practice member had one unread inbox notice and a red 1 in the header.
 * They clicked "Öffnen", read it, and the 1 stayed. Three separate things were
 * missing, and fixing any one alone would not have helped:
 *
 *   1. the list's "Öffnen" was a plain link — nothing was ever marked read
 *   2. the detail page only marked read from an explicit button
 *   3. the header count was fetched once and had no way to hear about a change
 *
 * ── What this file covers ───────────────────────────────────────────────────
 * The server half: the mutation itself, its authorisation, its idempotence,
 * and — the part the badge depends on — that the count endpoint actually moves
 * when an item is read. The client half (opening triggers it, the badge is
 * told) is in the client suites, because that is where those wires live.
 *
 * The count is what the user sees, so it is asserted as a NUMBER at every
 * step, not merely as "the mutation returned ok".
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-inbox-read";

const { prisma } = await import("../lib/prisma.js");
const { requireAuth } = await import("../middleware/requireAuth.js");
const { default: practiceInboxRouter } = await import("../routes/practiceInbox.js");

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const app = express();
app.use(express.json());
app.use("/api/practice/inbox", requireAuth, practiceInboxRouter);
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const origin = `http://127.0.0.1:${server.address().port}/api/practice/inbox`;

const stamp = `${Date.now()}${crypto.randomInt(1e5)}`;
const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

/** The number the header badge shows. */
async function unreadCount(practiceId, actorUserId) {
  const res = await fetch(`${origin}/count?practiceId=${encodeURIComponent(practiceId)}`, {
    headers: { Authorization: `Bearer ${token(actorUserId)}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, count: body.unreadCount ?? body.newCount ?? null };
}

/** What the client does when a notice is opened. */
async function markRead(itemId, practiceId, actorUserId) {
  const res = await fetch(`${origin}/${itemId}/read`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token(actorUserId)}`,
    },
    body: JSON.stringify({ practiceId }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let W;

test.before(async () => {
  if (!dbAvailable) return;

  const mk = (tag) =>
    prisma.user.create({
      data: {
        email: `ibx-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });
  const [ownerA, ownerB] = await Promise.all([mk("oa"), mk("ob")]);

  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "A", publicSlug: `ibxa-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "B", publicSlug: `ibxb-${stamp}`, isActive: true },
  });
  await prisma.practiceMember.createMany({
    data: [
      { practiceProfileId: practiceA.id, userId: ownerA.id, role: "owner", status: "active", acceptedAt: new Date() },
      { practiceProfileId: practiceB.id, userId: ownerB.id, role: "owner", status: "active", acceptedAt: new Date() },
    ],
  });

  W = { ownerA, ownerB, practiceA, practiceB };
});

test.after(async () => {
  if (dbAvailable) {
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } });
    await prisma.$disconnect();
  }
  server.close();
});

/** One unread notice in a practice, with nothing else there. */
async function freshInbox(practiceId, howMany = 1) {
  await prisma.practiceInboxItem.deleteMany({ where: { practiceProfileId: practiceId } });
  const items = [];
  for (let i = 0; i < howMany; i++) {
    items.push(
      await prisma.practiceInboxItem.create({
        data: {
          practiceProfileId: practiceId,
          type: "message",
          title: `probe ${i} ${crypto.randomUUID()}`,
          status: "new",
        },
      }),
    );
  }
  return items;
}

/* ═════════════════════════════ T1 — one unread, opened, badge clears */

test("T1: one unread notice, opened → read, count 0", { skip }, async () => {
  const [item] = await freshInbox(W.practiceA.id, 1);

  const before = await unreadCount(W.practiceA.id, W.ownerA.id);
  assert.equal(before.count, 1, "the badge should start at 1");

  const marked = await markRead(item.id, W.practiceA.id, W.ownerA.id);
  assert.equal(marked.status, 200, JSON.stringify(marked.body));
  assert.equal(marked.body.item.status, "read");
  assert.ok(marked.body.item.readAt, "readAt was not recorded");

  const after = await unreadCount(W.practiceA.id, W.ownerA.id);
  assert.equal(after.count, 0, "the badge did not clear");
});

/* ═════════════════════════════ T2 — N unread, one opened, N-1 */

test("T2: three unread, one opened → count 2, not 0", { skip }, async () => {
  const items = await freshInbox(W.practiceA.id, 3);
  assert.equal((await unreadCount(W.practiceA.id, W.ownerA.id)).count, 3);

  await markRead(items[1].id, W.practiceA.id, W.ownerA.id);

  const after = await unreadCount(W.practiceA.id, W.ownerA.id);
  assert.equal(after.count, 2, "opening one notice must not clear the others");

  // And it is the one that was opened, not an arbitrary one.
  const rows = await prisma.practiceInboxItem.findMany({
    where: { practiceProfileId: W.practiceA.id },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    rows.map((r) => r.status),
    ["new", "read", "new"],
    "the wrong notice was marked read",
  );
});

/* ═════════════════════════════ T3 — idempotent */

test("T3: opening an already-read notice again changes nothing", { skip }, async () => {
  const [item] = await freshInbox(W.practiceA.id, 1);
  await markRead(item.id, W.practiceA.id, W.ownerA.id);

  const afterFirst = await prisma.practiceInboxItem.findUnique({ where: { id: item.id } });
  const countAfterFirst = (await unreadCount(W.practiceA.id, W.ownerA.id)).count;
  assert.equal(countAfterFirst, 0);

  const second = await markRead(item.id, W.practiceA.id, W.ownerA.id);
  assert.equal(second.status, 200, "a second open should not fail");

  const afterSecond = await prisma.practiceInboxItem.findUnique({ where: { id: item.id } });
  assert.equal(afterSecond.status, "read");
  assert.deepEqual(
    afterSecond.readAt,
    afterFirst.readAt,
    "readAt moved — the first time it was read is the one that matters",
  );
  assert.equal((await unreadCount(W.practiceA.id, W.ownerA.id)).count, 0);
});

test("T3b: a notice already marked done is not pushed back to read", { skip }, async () => {
  // "Read" and "done" answer different questions. Opening a finished notice
  // must not undo the fact that it was finished.
  const [item] = await freshInbox(W.practiceA.id, 1);
  await fetch(`${origin}/${item.id}/done`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(W.ownerA.id)}` },
    body: JSON.stringify({ practiceId: W.practiceA.id }),
  });

  await markRead(item.id, W.practiceA.id, W.ownerA.id);
  const row = await prisma.practiceInboxItem.findUnique({ where: { id: item.id } });
  assert.equal(row.status, "done", "opening a done notice reset it to read");
});

/* ═════════════════════════════ T4 — listing does not read */

test("T4: merely listing the inbox leaves everything unread", { skip }, async () => {
  await freshInbox(W.practiceA.id, 2);

  const list = await fetch(`${origin}?practiceId=${encodeURIComponent(W.practiceA.id)}`, {
    headers: { Authorization: `Bearer ${token(W.ownerA.id)}` },
  });
  assert.ok(list.ok, `listing failed: ${list.status}`);

  const after = await unreadCount(W.practiceA.id, W.ownerA.id);
  assert.equal(after.count, 2, "opening the list marked notices read");

  const rows = await prisma.practiceInboxItem.findMany({
    where: { practiceProfileId: W.practiceA.id },
  });
  assert.deepEqual([...new Set(rows.map((r) => r.status))], ["new"]);
});

/* ═════════════════════════════ T5 — cross-practice isolation */

test("T5: another practice cannot mark this practice's notice read", { skip }, async () => {
  const [item] = await freshInbox(W.practiceA.id, 1);
  await freshInbox(W.practiceB.id, 0);

  for (const [label, actor, practiceId] of [
    ["B's owner naming B", W.ownerB.id, W.practiceB.id],
    ["B's owner naming A", W.ownerB.id, W.practiceA.id],
  ]) {
    const r = await markRead(item.id, practiceId, actor);
    assert.ok(r.status >= 400, `${label} succeeded (${r.status})`);
  }

  const row = await prisma.practiceInboxItem.findUnique({ where: { id: item.id } });
  assert.equal(row.status, "new", "a foreign practice changed the notice");
  assert.equal((await unreadCount(W.practiceA.id, W.ownerA.id)).count, 1);
});

test("T5b: a nonexistent notice id is refused, not silently accepted", { skip }, async () => {
  const r = await markRead("cm00000000000000000000000", W.practiceA.id, W.ownerA.id);
  assert.ok(r.status >= 400, `an unknown id returned ${r.status}`);
});

/* ═════════════════════════════ T6 — a failure must not lie */

test("T6: when the mutation fails, the count is unchanged", { skip }, async () => {
  /*
   * The badge is read from the server, never computed on the client, so a
   * failed mutation cannot leave it claiming something that did not happen.
   * This asserts that property where it actually holds: the count endpoint is
   * the single source, and a refused write does not move it.
   */
  const [item] = await freshInbox(W.practiceA.id, 1);
  assert.equal((await unreadCount(W.practiceA.id, W.ownerA.id)).count, 1);

  // Archived notices are refused by the service.
  await prisma.practiceInboxItem.update({
    where: { id: item.id },
    data: { status: "archived", archivedAt: new Date() },
  });
  const refused = await markRead(item.id, W.practiceA.id, W.ownerA.id);
  assert.ok(refused.status >= 400, `an archived notice was marked read (${refused.status})`);

  // Back to unread, and a request with no practiceId is refused too.
  await prisma.practiceInboxItem.update({
    where: { id: item.id },
    data: { status: "new", archivedAt: null, readAt: null },
  });
  const noPractice = await fetch(`${origin}/${item.id}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(W.ownerA.id)}` },
    body: JSON.stringify({}),
  });
  assert.equal(noPractice.status, 400);

  const row = await prisma.practiceInboxItem.findUnique({ where: { id: item.id } });
  assert.equal(row.status, "new", "a refused request changed the notice anyway");
  assert.equal(
    (await unreadCount(W.practiceA.id, W.ownerA.id)).count,
    1,
    "the count moved despite the mutation being refused",
  );
});

test("unauthenticated requests reach nothing", { skip }, async () => {
  const [item] = await freshInbox(W.practiceA.id, 1);
  const res = await fetch(`${origin}/${item.id}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId: W.practiceA.id }),
  });
  assert.equal(res.status, 401);

  const row = await prisma.practiceInboxItem.findUnique({ where: { id: item.id } });
  assert.equal(row.status, "new");
});
