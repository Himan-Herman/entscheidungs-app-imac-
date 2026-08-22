/**
 * Editing and withdrawing, client side (Phase 3B).
 *
 * Tested as pure functions, without a browser and without a DOM, following the
 * repository's existing client-test style.
 *
 * The client's job here is narrow and worth stating: it shows the controls the
 * SERVER says exist, it replaces one message when the server answers, and it
 * never decides for itself whether a message may still be changed. These tests
 * hold it to exactly that.
 *
 * Run: node --test src/features/practiceContext/__tests__/messageEditWithdraw.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMessageUpdate,
  isEdited,
  isWithdrawn,
  mergeTimeline,
  messageActions,
  messageReadState,
  readBoundaryOf,
} from "../lib/messageTimeline.js";

const msg = (id, senderType, extra = {}) => ({
  id,
  senderType,
  body: `body of ${id}`,
  createdAt: "2026-08-21T10:00:00.000Z",
  readAt: null,
  editedAt: null,
  withdrawnAt: null,
  ...extra,
});

/* ------------------------------------------- Test 1: which controls show */

test("controls appear only where the server said they may", () => {
  assert.deepEqual(messageActions(msg("m1", "patient", { canEdit: true, canWithdraw: true })), {
    canEdit: true,
    canWithdraw: true,
  });
  assert.deepEqual(messageActions(msg("m2", "patient", { canEdit: false, canWithdraw: false })), {
    canEdit: false,
    canWithdraw: false,
  });
});

test("a message the server said nothing about offers nothing", () => {
  // A received message carries no capability at all. Treating "not stated" as
  // "allowed" would put controls on someone else's words.
  assert.deepEqual(messageActions(msg("m1", "practice")), { canEdit: false, canWithdraw: false });
  assert.deepEqual(messageActions(undefined), { canEdit: false, canWithdraw: false });
  assert.deepEqual(messageActions(null), { canEdit: false, canWithdraw: false });
});

test("the client never infers the window from readAt on its own", () => {
  // Unread, own, not withdrawn — and still no controls, because the server did
  // not grant them (the relationship may have ended, or the role may not allow
  // writing). The client is not entitled to a second opinion.
  const unreadButNotGranted = msg("m1", "patient", { readAt: null });
  assert.deepEqual(messageActions(unreadButNotGranted), { canEdit: false, canWithdraw: false });
});

test("a read message carries no controls", () => {
  const read = msg("m1", "patient", {
    readAt: "2026-08-21T11:00:00.000Z",
    canEdit: false,
    canWithdraw: false,
  });
  assert.equal(messageActions(read).canEdit, false);
  assert.equal(messageActions(read).canWithdraw, false);
});

/* ------------------------------------------------ Test 2: message states */

test("a withdrawn message is recognisable and reports no read state", () => {
  const gone = msg("m1", "patient", { withdrawnAt: "2026-08-21T12:00:00.000Z" });
  assert.equal(isWithdrawn(gone), true);
  assert.equal(isEdited(gone), false);
});

test("a withdrawn message that was also edited reads as withdrawn", () => {
  const both = msg("m1", "patient", {
    editedAt: "2026-08-21T11:00:00.000Z",
    withdrawnAt: "2026-08-21T12:00:00.000Z",
  });
  // Withdrawal is the later and the terminal fact; announcing "edited" on a
  // message with no content left would say nothing useful.
  assert.equal(isWithdrawn(both), true);
  assert.equal(isEdited(both), false);
});

test("an edited message says so, an untouched one does not", () => {
  assert.equal(isEdited(msg("m1", "patient", { editedAt: "2026-08-21T11:00:00.000Z" })), true);
  assert.equal(isEdited(msg("m2", "patient")), false);
});

test("editing does not change the read state that is shown", () => {
  const edited = msg("m1", "patient", { editedAt: "2026-08-21T11:00:00.000Z" });
  assert.equal(messageReadState(edited, "patient"), "sent");
});

/* ------------------------------------------- Test 3: applying the answer */

test("the changed message replaces its own entry and nothing else", () => {
  const timeline = [msg("m1", "patient"), msg("m2", "practice"), msg("m3", "patient")];
  const changed = msg("m2", "practice", { body: "corrected" });

  const next = applyMessageUpdate(timeline, changed);
  assert.deepEqual(next.map((m) => m.id), ["m1", "m2", "m3"], "the order is untouched");
  assert.equal(next[1].body, "corrected");
  assert.equal(next[0], timeline[0], "the others are the same objects");
  assert.equal(next[2], timeline[2]);
});

test("loaded history survives a mutation", () => {
  // A page of older messages was loaded, then the oldest of them is edited.
  const timeline = mergeTimeline(
    [msg("old1", "patient"), msg("old2", "patient")],
    [msg("m1", "patient"), msg("m2", "patient")],
  );
  const next = applyMessageUpdate(timeline, msg("old1", "patient", { body: "fixed" }));

  assert.deepEqual(next.map((m) => m.id), ["old1", "old2", "m1", "m2"]);
  assert.equal(next[0].body, "fixed");
});

test("a mutation never appends a second copy of the message", () => {
  const timeline = [msg("m1", "patient")];
  const next = applyMessageUpdate(timeline, msg("m1", "patient", { body: "changed" }));
  assert.equal(next.length, 1);
});

test("an answer about a message this timeline does not hold is ignored", () => {
  // A late answer that belongs to a conversation the reader has left. Adding it
  // would put another context's message on screen.
  const timeline = [msg("m1", "patient")];
  const next = applyMessageUpdate(timeline, msg("foreign", "patient"));
  assert.deepEqual(next.map((m) => m.id), ["m1"]);
  assert.equal(next, timeline, "nothing changed, so nothing was rebuilt");
});

test("a malformed or empty answer changes nothing", () => {
  const timeline = [msg("m1", "patient")];
  assert.equal(applyMessageUpdate(timeline, null), timeline);
  assert.equal(applyMessageUpdate(timeline, undefined), timeline);
  assert.equal(applyMessageUpdate(timeline, {}), timeline);
  assert.deepEqual(applyMessageUpdate(null, msg("m1", "patient")), []);
});

test("withdrawing keeps the message in place, without its body", () => {
  const timeline = [msg("m1", "patient"), msg("m2", "patient"), msg("m3", "patient")];
  const withdrawn = {
    id: "m2",
    senderType: "patient",
    createdAt: timeline[1].createdAt,
    readAt: null,
    withdrawnAt: "2026-08-21T12:00:00.000Z",
  };

  const next = applyMessageUpdate(timeline, withdrawn);
  assert.deepEqual(next.map((m) => m.id), ["m1", "m2", "m3"], "the timeline does not shrink");
  assert.equal(next[1].body, undefined, "and carries no text");
  assert.equal(isWithdrawn(next[1]), true);
});

/* ------------------------------------ Test 4: interaction with 3A state */

test("a mutation does not move the read boundary", () => {
  const timeline = [msg("m1", "practice"), msg("m2", "patient")];
  const before = readBoundaryOf(timeline);
  const after = readBoundaryOf(applyMessageUpdate(timeline, msg("m1", "practice", { body: "x" })));
  assert.equal(after, before);
});

test("a withdrawn message stays the boundary if it is the newest", () => {
  const timeline = [
    msg("m1", "practice"),
    msg("m2", "practice", { withdrawnAt: "2026-08-21T12:00:00.000Z" }),
  ];
  // The boundary names the newest message SEEN, whatever state it is in —
  // skipping it would leave it permanently unacknowledged.
  assert.equal(readBoundaryOf(timeline), "m2");
});

test("a later merge does not resurrect a withdrawn message's body", () => {
  const withdrawn = {
    id: "m1",
    senderType: "patient",
    createdAt: "2026-08-21T10:00:00.000Z",
    withdrawnAt: "2026-08-21T12:00:00.000Z",
  };
  const stale = msg("m1", "patient", { body: "the old text" });

  // The fresher copy wins in a merge, and the fresher copy is the withdrawn
  // one — the order of arguments is what decides, so this pins it down.
  const merged = mergeTimeline([stale], [withdrawn]);
  assert.equal(merged[0].body, undefined);
  assert.equal(isWithdrawn(merged[0]), true);
});
