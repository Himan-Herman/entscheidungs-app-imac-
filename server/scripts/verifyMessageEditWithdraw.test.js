/**
 * Editing and withdrawing a message (Phase 3B).
 *
 * The rule under test is a single sentence: a message may be changed or taken
 * back only for as long as the OTHER side has not read that exact message.
 *
 * What makes it hard is that "has not read it" is not a fact one can look up
 * and then act on — the recipient may read it in the microsecond between the
 * lookup and the change. So the tests here are not only about who may do what;
 * several of them force a real race and check that the read always wins.
 *
 * Run: node --test scripts/verifyMessageEditWithdraw.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  editMessage,
  getChannelForPatientLink,
  listThreadMessagesPage,
  markThreadRead,
  withdrawMessage,
} from "../services/communication/practicePatientThreadService.js";

const SUFFIX = "editwithdraw@test.invalid";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/**
 * Patient P with two links to ONE practice, plus an unrelated patient Q, and a
 * second practice member — everything the scoping tests need to be more than
 * a happy path.
 */
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
  const colleague = await mk("c");

  const practice = await prisma.practiceProfile.create({
    data: {
      userId: owner.id,
      practiceName: "PraxisEditWithdraw",
      publicSlug: `ew-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    },
  });

  const profile = await prisma.patientProfile.create({
    data: { userId: patient.id, displayName: "Angehoerige", relationLabel: "child" },
  });

  const link = (pat, profileId = null, status = "active") =>
    prisma.practicePatientLink.create({
      data: {
        practiceProfileId: practice.id,
        patientUserId: pat.id,
        patientProfileId: profileId,
        status,
        // The LEGACY scope name, which is what the consent gate reads.
        consentScopes: ["messages"],
        consentAcceptedAt: new Date(),
      },
    });
  const linkA = await link(patient);
  const linkA2 = await link(patient, profile.id);
  const linkQ = await link(other);
  const linkEnded = await link(patient, null, "ended");

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
  const threadEnded = await thread(linkEnded);

  const say = (t, senderType, senderUserId, body, extra = {}) =>
    prisma.practicePatientMessage.create({
      data: { threadId: t.id, senderType, senderUserId, body, ...extra },
    });

  return {
    patient, other, owner, colleague, practice,
    linkA, linkA2, linkQ, linkEnded,
    threadA, threadA2, threadQ, threadEnded,
    say,
    /** The patient's own, still unread message in thread A. */
    mine: (body = "original text", t = threadA) => say(t, "patient", patient.id, body),
  };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: SUFFIX } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

const asPatient = (f) => ({ senderType: "patient", senderUserId: f.patient.id });
const asOwner = (f) => ({ senderType: "practice", senderUserId: f.owner.id });
const bodyOf = (id) =>
  prisma.practicePatientMessage
    .findUnique({ where: { id }, select: { body: true } })
    .then((r) => r?.body);

/* ============================================================ Editing */

test("an own unread message can be edited", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  const out = await editMessage({
    threadId: f.threadA.id,
    messageId: m.id,
    actor: asPatient(f),
    body: "corrected text",
  });

  assert.equal(out.body, "corrected text");
  assert.ok(out.editedAt, "an edited message says so");
  assert.equal(out.readAt, null, "editing does not read the message");
});

test("editing keeps the message's identity and its place", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await prisma.practicePatientMessage.create({
    data: {
      threadId: f.threadA.id,
      senderType: "patient",
      senderUserId: f.patient.id,
      body: "first",
      clientRequestId: "send-action-1",
    },
  });

  const out = await editMessage({
    threadId: f.threadA.id,
    messageId: m.id,
    actor: asPatient(f),
    body: "second",
  });

  assert.equal(out.id, m.id, "the same message, not a new one");
  assert.deepEqual(out.createdAt, m.createdAt, "its position in the timeline is fixed");
  assert.equal(out.clientRequestId, "send-action-1", "no new send action");
  assert.equal(
    await prisma.practicePatientMessage.count({ where: { threadId: f.threadA.id } }),
    1,
    "editing must not append a second message",
  );
});

test("a message the practice has read can no longer be edited", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  await markThreadRead(f.threadA.id, "practice", {
    linkId: f.linkA.id,
    practiceProfileId: f.practice.id,
    actorUserId: f.owner.id,
    throughMessageId: m.id,
  });

  await assert.rejects(
    editMessage({
      threadId: f.threadA.id,
      messageId: m.id,
      actor: asPatient(f),
      body: "too late",
    }),
    /message_already_read/,
  );
  assert.equal(await bodyOf(m.id), "original text", "the read text stands");
});

test("nobody may edit a message they did not write", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const practiceMsg = await f.say(f.threadA, "practice", f.owner.id, "from the practice");

  // The patient, on a practice message.
  await assert.rejects(
    editMessage({
      threadId: f.threadA.id,
      messageId: practiceMsg.id,
      actor: asPatient(f),
      body: "not mine to change",
    }),
    /message_not_found/,
  );

  // A colleague at the SAME practice, on a message written by the owner. Same
  // party, different person — still not theirs.
  await assert.rejects(
    editMessage({
      threadId: f.threadA.id,
      messageId: practiceMsg.id,
      actor: { senderType: "practice", senderUserId: f.colleague.id },
      body: "putting words in a colleague's mouth",
    }),
    /message_not_found/,
  );
  assert.equal(await bodyOf(practiceMsg.id), "from the practice");
});

test("a message with no recorded sender belongs to nobody", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const orphan = await prisma.practicePatientMessage.create({
    data: {
      threadId: f.threadA.id,
      senderType: "patient",
      senderUserId: null,
      body: "written before senders were recorded",
    },
  });

  await assert.rejects(
    editMessage({
      threadId: f.threadA.id,
      messageId: orphan.id,
      actor: asPatient(f),
      body: "claiming it",
    }),
    /message_not_found/,
  );
});

test("a message cannot be edited through another conversation", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  // Same patient, same practice — but the OTHER link. The message id is real
  // and the actor really is its sender; only the conversation is wrong.
  await assert.rejects(
    editMessage({
      threadId: f.threadA2.id,
      messageId: m.id,
      actor: asPatient(f),
      body: "through the wrong door",
    }),
    /message_not_found/,
  );
  assert.equal(await bodyOf(m.id), "original text");
});

test("another patient cannot edit this conversation's messages", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  await assert.rejects(
    editMessage({
      threadId: f.threadA.id,
      messageId: m.id,
      actor: { senderType: "patient", senderUserId: f.other.id },
      body: "not their conversation",
    }),
    /message_not_found/,
  );
  assert.equal(await bodyOf(m.id), "original text");
});

test("an edit down to nothing is refused — that is what withdrawing is for", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  for (const empty of ["", "   ", "\n\t "]) {
    await assert.rejects(
      editMessage({ threadId: f.threadA.id, messageId: m.id, actor: asPatient(f), body: empty }),
      /validation_required/,
    );
  }
  assert.equal(await bodyOf(m.id), "original text");
});

test("the existing length limit applies to an edit too", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  await assert.rejects(
    editMessage({
      threadId: f.threadA.id,
      messageId: m.id,
      actor: asPatient(f),
      body: "x".repeat(8001),
    }),
    /validation_text_too_long/,
  );
});

test("a message may be edited more than once while it stays unread", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  const first = await editMessage({
    threadId: f.threadA.id, messageId: m.id, actor: asPatient(f), body: "second",
  });
  const second = await editMessage({
    threadId: f.threadA.id, messageId: m.id, actor: asPatient(f), body: "third",
  });

  assert.equal(second.body, "third");
  assert.ok(second.editedAt >= first.editedAt, "each edit updates the marker");
});

/* ======================================================== Withdrawing */

test("an own unread message can be withdrawn, and loses its text", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine("something the sender regrets");

  const out = await withdrawMessage({
    threadId: f.threadA.id, messageId: m.id, actor: asPatient(f),
  });

  assert.ok(out.withdrawnAt, "the withdrawal is recorded");
  assert.equal(out.body, "", "the text is gone from the row, not merely hidden");
  assert.equal(out.readAt, null, "withdrawing is not reading");
  assert.equal(
    await prisma.practicePatientMessage.count({ where: { id: m.id } }),
    1,
    "the message stays in the timeline as an event",
  );
});

test("a message the practice has read can no longer be withdrawn", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  await markThreadRead(f.threadA.id, "practice", {
    linkId: f.linkA.id,
    practiceProfileId: f.practice.id,
    actorUserId: f.owner.id,
    throughMessageId: m.id,
  });

  await assert.rejects(
    withdrawMessage({ threadId: f.threadA.id, messageId: m.id, actor: asPatient(f) }),
    /message_already_read/,
  );
  assert.equal(await bodyOf(m.id), "original text", "a read message keeps its text");
});

test("a withdrawn message cannot be edited back into existence", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();
  await withdrawMessage({ threadId: f.threadA.id, messageId: m.id, actor: asPatient(f) });

  await assert.rejects(
    editMessage({ threadId: f.threadA.id, messageId: m.id, actor: asPatient(f), body: "back again" }),
    /message_withdrawn/,
  );
  assert.equal(await bodyOf(m.id), "", "withdrawal is terminal");
});

test("withdrawing twice is refused and never restores anything", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();
  const first = await withdrawMessage({
    threadId: f.threadA.id, messageId: m.id, actor: asPatient(f),
  });

  await assert.rejects(
    withdrawMessage({ threadId: f.threadA.id, messageId: m.id, actor: asPatient(f) }),
    /message_withdrawn/,
  );

  const after = await prisma.practicePatientMessage.findUnique({ where: { id: m.id } });
  assert.equal(after.body, "");
  assert.deepEqual(after.withdrawnAt, first.withdrawnAt, "the first withdrawal stands");
});

test("an edited message may still be withdrawn while it is unread", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();
  await editMessage({ threadId: f.threadA.id, messageId: m.id, actor: asPatient(f), body: "revised" });

  const out = await withdrawMessage({
    threadId: f.threadA.id, messageId: m.id, actor: asPatient(f),
  });
  assert.ok(out.withdrawnAt, "editing does not close the window");
  assert.equal(out.body, "");
});

test("the practice may withdraw its own message on the same terms", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.say(f.threadA, "practice", f.owner.id, "practice text");

  const out = await withdrawMessage({
    threadId: f.threadA.id, messageId: m.id, actor: asOwner(f),
  });
  assert.equal(out.body, "");

  // ...and once the PATIENT has read it, the practice loses the same window.
  const second = await f.say(f.threadA, "practice", f.owner.id, "second practice text");
  await markThreadRead(f.threadA.id, "patient", {
    patientUserId: f.patient.id,
    throughMessageId: second.id,
  });
  await assert.rejects(
    withdrawMessage({ threadId: f.threadA.id, messageId: second.id, actor: asOwner(f) }),
    /message_already_read/,
  );
});

/* ===================================================== Ended relationship */

test("an ended relationship accepts no edit and no withdrawal", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.say(f.threadEnded, "patient", f.patient.id, "said while it lasted");

  for (const act of [
    () => editMessage({
      threadId: f.threadEnded.id, messageId: m.id, actor: asPatient(f), body: "after the end",
    }),
    () => withdrawMessage({ threadId: f.threadEnded.id, messageId: m.id, actor: asPatient(f) }),
  ]) {
    await assert.rejects(act, /consent_required/);
  }
  // The history itself is untouched — ending a relationship does not rewrite it.
  assert.equal(await bodyOf(m.id), "said while it lasted");
});

/* ================================================================ Races */

/**
 * Forces the interleaving that matters.
 *
 * A transaction takes the row lock and holds it while the mutation is already
 * in flight; the read then commits inside that transaction. The mutation's
 * UPDATE can only proceed once the lock is released — by which time `readAt` is
 * set, and its condition no longer matches.
 *
 * This is the case a "check, then change" implementation would get wrong, and
 * it is forced here rather than hoped for.
 */
async function readCommitsWhileMutationInFlight(messageId, startMutation) {
  let mutation;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "PracticePatientMessage" WHERE id = ${messageId} FOR UPDATE`;
    mutation = startMutation();
    // Long enough for the mutation to have reached its UPDATE and be waiting.
    await new Promise((r) => setTimeout(r, 120));
    await tx.practicePatientMessage.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });
  });
  return mutation;
}

test("a read that commits mid-edit wins — the edit does not", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  const edit = await readCommitsWhileMutationInFlight(m.id, () =>
    editMessage({
      threadId: f.threadA.id, messageId: m.id, actor: asPatient(f), body: "raced text",
    }).catch((e) => e),
  );

  const after = await prisma.practicePatientMessage.findUnique({ where: { id: m.id } });
  assert.ok(after.readAt, "the read committed");
  assert.ok(edit instanceof Error, `the edit must lose, got ${JSON.stringify(edit)}`);
  assert.match(edit.message, /message_already_read/);
  assert.equal(after.body, "original text", "the text the reader saw is the text that stands");
  assert.equal(after.editedAt, null);
});

test("a read that commits mid-withdrawal wins — the withdrawal does not", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.mine();

  const withdrawal = await readCommitsWhileMutationInFlight(m.id, () =>
    withdrawMessage({ threadId: f.threadA.id, messageId: m.id, actor: asPatient(f) }).catch((e) => e),
  );

  const after = await prisma.practicePatientMessage.findUnique({ where: { id: m.id } });
  assert.ok(after.readAt, "the read committed");
  assert.ok(withdrawal instanceof Error, "the withdrawal must lose");
  assert.match(withdrawal.message, /message_already_read/);
  assert.equal(after.body, "original text", "a read message keeps what it said");
  assert.equal(after.withdrawnAt, null);
});

test("under real concurrency there is exactly one consistent end state", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const outcomes = { edited: 0, refused: 0 };
  for (let i = 0; i < 12; i += 1) {
    const m = await f.mine(`round ${i}`);

    // No lock, no sleep: both start at once and the database decides.
    const [read, edit] = await Promise.allSettled([
      markThreadRead(f.threadA.id, "practice", {
        linkId: f.linkA.id,
        practiceProfileId: f.practice.id,
        actorUserId: f.owner.id,
        throughMessageId: m.id,
      }),
      editMessage({
        threadId: f.threadA.id, messageId: m.id, actor: asPatient(f), body: `edited ${i}`,
      }),
    ]);
    assert.equal(read.status, "fulfilled", "the read must never fail because of a concurrent edit");

    const after = await prisma.practicePatientMessage.findUnique({ where: { id: m.id } });
    if (edit.status === "fulfilled") {
      outcomes.edited += 1;
      assert.equal(after.body, `edited ${i}`, "a successful edit must be the state that persists");
      assert.ok(after.editedAt);
    } else {
      outcomes.refused += 1;
      assert.equal(after.body, `round ${i}`, "a refused edit must leave no trace");
      assert.equal(after.editedAt, null);
      assert.ok(after.readAt, "an edit is only refused because the read got there first");
    }
  }
  // Both halves have to be reachable; a run that only ever took one branch
  // would not have tested the other.
  assert.equal(outcomes.edited + outcomes.refused, 12);
});

/* ============================================ Privacy and presentation */

test("a withdrawn message is delivered without its body", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const kept = await f.mine("still here");
  const gone = await f.mine("this must not be delivered");
  await withdrawMessage({ threadId: f.threadA.id, messageId: gone.id, actor: asPatient(f) });

  const { channel } = await getChannelForPatientLink(f.linkA.id, f.patient.id);
  const serialized = JSON.stringify(channel);
  assert.ok(!serialized.includes("this must not be delivered"), "the withdrawn text must not travel");

  const withdrawn = channel.messages.find((m) => m.id === gone.id);
  assert.ok(withdrawn, "the message is still an event in the conversation");
  assert.equal(withdrawn.body, undefined, "and it carries no body");
  assert.ok(withdrawn.withdrawnAt, "its state says why");
  assert.equal(withdrawn.senderType, "patient", "authorship survives");
  assert.ok(withdrawn.createdAt, "so does its place in time");

  const untouched = channel.messages.find((m) => m.id === kept.id);
  assert.equal(untouched.body, "still here");
});

test("the withdrawn body does not leak through a page of history either", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const gone = await f.mine("secret that was taken back");
  await withdrawMessage({ threadId: f.threadA.id, messageId: gone.id, actor: asPatient(f) });

  const page = await listThreadMessagesPage(f.threadA.id, {});
  assert.ok(!JSON.stringify(page).includes("secret that was taken back"));
  assert.equal(page.messages.find((m) => m.id === gone.id).body, undefined);
});

test("a withdrawn message stops counting as something to read", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const a = await f.say(f.threadA, "practice", f.owner.id, "one");
  await f.say(f.threadA, "practice", f.owner.id, "two");

  const before = await getChannelForPatientLink(f.linkA.id, f.patient.id);
  assert.equal(before.channel.unreadCount, 2);

  await withdrawMessage({ threadId: f.threadA.id, messageId: a.id, actor: asOwner(f) });

  const after = await getChannelForPatientLink(f.linkA.id, f.patient.id);
  assert.equal(after.channel.unreadCount, 1, "a badge must not promise a message that is gone");
  // Its read state is untouched all the same: withdrawing is not reading.
  const row = await prisma.practicePatientMessage.findUnique({ where: { id: a.id } });
  assert.equal(row.readAt, null);
});

/* ========================================================= Capabilities */

test("capabilities are offered on one's own mutable messages only", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  // Order matters: the acknowledgement covers everything UP TO its boundary, so
  // the still-editable message has to be written after it. Building the fixture
  // the other way round would quietly acknowledge that one too — and the test
  // would then be checking the wrong thing.
  const read = await f.mine("already read");
  await markThreadRead(f.threadA.id, "practice", {
    linkId: f.linkA.id,
    practiceProfileId: f.practice.id,
    actorUserId: f.owner.id,
    throughMessageId: read.id,
  });

  const theirs = await f.say(f.threadA, "practice", f.owner.id, "theirs");
  const withdrawn = await f.mine("withdrawn");
  await withdrawMessage({ threadId: f.threadA.id, messageId: withdrawn.id, actor: asPatient(f) });
  const mine = await f.mine("mine, unread");

  const { channel } = await getChannelForPatientLink(f.linkA.id, f.patient.id);
  const by = (id) => channel.messages.find((m) => m.id === id);

  assert.equal(by(mine.id).canEdit, true);
  assert.equal(by(mine.id).canWithdraw, true);
  assert.equal(by(read.id).canEdit, false, "read closes the window");
  assert.equal(by(withdrawn.id).canEdit, false, "withdrawal is terminal");
  assert.equal(by(theirs.id).canEdit, undefined, "the question does not apply to a received message");
  assert.equal(by(theirs.id).canWithdraw, undefined);
});

test("an ended relationship offers no capability, however unread the message", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);
  const m = await f.say(f.threadEnded, "patient", f.patient.id, "unread but untouchable");

  const { channel } = await getChannelForPatientLink(f.linkEnded.id, f.patient.id);
  const shown = channel.messages.find((x) => x.id === m.id);
  assert.equal(shown.readAt, null, "still unread");
  assert.equal(shown.canEdit, false, "and still not changeable");
  assert.equal(shown.canWithdraw, false);
});

/* =========================================================== Pagination */

test("editing and withdrawing leave the cursor and the order alone", { skip }, async (t) => {
  const f = await buildFixture();
  t.after(cleanup);

  const base = new Date("2026-02-01T09:00:00.000Z").getTime();
  const ids = [];
  for (let i = 0; i < 6; i += 1) {
    const m = await prisma.practicePatientMessage.create({
      data: {
        threadId: f.threadA.id,
        senderType: "patient",
        senderUserId: f.patient.id,
        body: `p${i}`,
        createdAt: new Date(base + i * 1000),
      },
    });
    ids.push(m.id);
  }

  const before = await listThreadMessagesPage(f.threadA.id, {});
  const orderBefore = before.messages.map((m) => m.id);

  // Change the OLDEST message, the one an `updatedAt` sort would fling to the end.
  const oldest = await editMessage({
    threadId: f.threadA.id, messageId: ids[0], actor: asPatient(f), body: "p0 corrected",
  });
  await withdrawMessage({ threadId: f.threadA.id, messageId: ids[1], actor: asPatient(f) });

  const after = await listThreadMessagesPage(f.threadA.id, {});
  assert.deepEqual(after.messages.map((m) => m.id), orderBefore, "the order is unchanged");
  assert.equal(after.olderCursor, before.olderCursor, "and so is the cursor");
  assert.deepEqual(
    oldest.createdAt,
    new Date(base),
    "an edited message keeps the time it was sent",
  );
});

test("cleanup leaves no fixture rows behind", { skip }, async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { email: { contains: SUFFIX } } }), 0);
});
