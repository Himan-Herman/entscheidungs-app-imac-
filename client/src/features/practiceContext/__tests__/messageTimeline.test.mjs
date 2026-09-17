/**
 * Message timeline rules (Phase 3A).
 *
 * Tested as pure functions, without a browser and without a DOM, following the
 * repository's existing client-test style.
 *
 * The goals here are the client half of the per-message read model:
 *   - the acknowledgement names the last message SEEN, not "the thread"
 *   - a message that arrives later is never covered by an earlier boundary
 *   - a read state is shown on one's own messages only, and claims nothing
 *     beyond sent / read
 *   - paging and sending never make a message disappear from the timeline
 *
 * Run: node --test src/features/practiceContext/__tests__/messageTimeline.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeTimeline,
  messageReadState,
  readBoundaryOf,
} from "../lib/messageTimeline.js";
import { hasUnreadFrom } from "../../communication/lib/threadReadState.js";

const msg = (id, senderType, extra = {}) => ({
  id,
  senderType,
  body: `body of ${id}`,
  createdAt: "2026-08-21T10:00:00.000Z",
  readAt: null,
  ...extra,
});

/* ------------------------------------------------ Test 1: read boundary */

test("the boundary is the newest message on screen, named by id", () => {
  const shown = [msg("m1", "practice"), msg("m2", "practice"), msg("m3", "patient")];
  assert.equal(readBoundaryOf(shown), "m3");
});

test("nothing on screen means no boundary — never an implicit 'everything'", () => {
  assert.equal(readBoundaryOf([]), null);
  assert.equal(readBoundaryOf(null), null);
  assert.equal(readBoundaryOf(undefined), null);
});

test("a message arriving after the boundary is not covered by it", () => {
  const shown = [msg("m1", "practice"), msg("m2", "practice")];
  const boundary = readBoundaryOf(shown);

  // The practice writes m3 while the acknowledgement is still in flight.
  const arrivedLater = msg("m3", "practice");
  const full = [...shown, arrivedLater];

  assert.equal(boundary, "m2");
  assert.notEqual(boundary, readBoundaryOf(full));
  // m3 sits AFTER the boundary in the total order, so the server's
  // "up to and including m2" cannot reach it.
  assert.equal(full.findIndex((m) => m.id === boundary) < full.length - 1, true);
});

test("the client sends an id, never a timestamp", () => {
  const boundary = readBoundaryOf([msg("m1", "practice")]);
  assert.equal(typeof boundary, "string");
  assert.equal(Number.isNaN(Date.parse(boundary)), true);
});

/* ------------------------------------------- Test 2: per-message state */

test("an own message that the other side has not read is 'sent'", () => {
  assert.equal(messageReadState(msg("m1", "patient"), "patient"), "sent");
});

test("an own message the other side has read is 'read'", () => {
  const seen = msg("m1", "patient", { readAt: "2026-08-21T11:00:00.000Z" });
  assert.equal(messageReadState(seen, "patient"), "read");
});

test("a received message carries no state — it is not the viewer's to report", () => {
  assert.equal(messageReadState(msg("m1", "practice"), "patient"), null);
  const seen = msg("m2", "practice", { readAt: "2026-08-21T11:00:00.000Z" });
  assert.equal(messageReadState(seen, "practice"), "read");
  assert.equal(messageReadState(seen, "patient"), null);
});

test("state is per message: an older read one never speaks for a newer unread one", () => {
  const older = msg("m1", "patient", { readAt: "2026-08-21T11:00:00.000Z" });
  const newer = msg("m2", "patient");
  assert.equal(messageReadState(older, "patient"), "read");
  assert.equal(messageReadState(newer, "patient"), "sent");
});

test("only two states exist — nothing claims delivery", () => {
  const values = new Set();
  for (const readAt of [null, "2026-08-21T11:00:00.000Z"]) {
    values.add(messageReadState(msg("m", "patient", { readAt }), "patient"));
  }
  assert.deepEqual([...values].sort(), ["read", "sent"]);
});

/* ----------------------------------------------------- Test 3: merging */

test("an older page is prepended, keeping one ascending order", () => {
  const current = [msg("m3", "practice"), msg("m4", "patient")];
  const olderPage = [msg("m1", "patient"), msg("m2", "practice")];
  assert.deepEqual(
    mergeTimeline(olderPage, current).map((m) => m.id),
    ["m1", "m2", "m3", "m4"],
  );
});

test("sending never drops the message the newest window pushed out", () => {
  // The window holds three. Everything older was already paged in.
  const paged = [msg("m1", "patient"), msg("m2", "practice")];
  const before = mergeTimeline(paged, [msg("m3", "practice"), msg("m4", "patient")]);

  // After sending, the server's window has slid forward and no longer contains
  // m3 — merging must not let that response delete it.
  const afterSend = [msg("m4", "patient"), msg("m5", "patient")];
  assert.deepEqual(
    mergeTimeline(before, afterSend).map((m) => m.id),
    ["m1", "m2", "m3", "m4", "m5"],
  );
});

test("the fresher copy of a message wins, and keeps its place", () => {
  const stale = [msg("m1", "patient"), msg("m2", "patient")];
  const fresh = [msg("m2", "patient", { readAt: "2026-08-21T11:00:00.000Z" })];
  const merged = mergeTimeline(stale, fresh);

  assert.deepEqual(merged.map((m) => m.id), ["m1", "m2"]);
  assert.equal(messageReadState(merged[1], "patient"), "read");
});

test("identity is the id — identical bodies and timestamps stay distinct", () => {
  const a = { ...msg("a", "patient"), body: "same" };
  const b = { ...msg("b", "patient"), body: "same" };
  assert.deepEqual(mergeTimeline([a], [b]).map((m) => m.id), ["a", "b"]);
});

test("merging is idempotent — a re-fetched page does not duplicate", () => {
  const page = [msg("m1", "patient"), msg("m2", "practice")];
  assert.deepEqual(mergeTimeline(page, page).map((m) => m.id), ["m1", "m2"]);
});

test("empty and missing inputs are joins, not failures", () => {
  const page = [msg("m1", "patient")];
  assert.deepEqual(mergeTimeline(null, page).map((m) => m.id), ["m1"]);
  assert.deepEqual(mergeTimeline(page, undefined).map((m) => m.id), ["m1"]);
  assert.deepEqual(mergeTimeline([], []), []);
});

/* --------------------------------------- Test 4: when to acknowledge */

test("a page of only own messages triggers no acknowledgement", () => {
  const mine = [msg("m1", "patient"), msg("m2", "patient")];
  assert.equal(hasUnreadFrom({ messages: mine }, "practice"), false);
});

test("one unread message from the other side is enough", () => {
  const mixed = [
    msg("m1", "patient", { readAt: "2026-08-21T11:00:00.000Z" }),
    msg("m2", "practice"),
  ];
  assert.equal(hasUnreadFrom({ messages: mixed }, "practice"), true);
});

test("after acknowledging, the same timeline asks for nothing more", () => {
  const acknowledged = [
    msg("m1", "practice", { readAt: "2026-08-21T11:00:00.000Z" }),
    msg("m2", "practice", { readAt: "2026-08-21T11:00:00.000Z" }),
  ];
  assert.equal(hasUnreadFrom({ messages: acknowledged }, "practice"), false);
});

test("loading older unread history reopens the question", () => {
  const current = [msg("m9", "practice", { readAt: "2026-08-21T11:00:00.000Z" })];
  assert.equal(hasUnreadFrom({ messages: current }, "practice"), false);

  const withHistory = mergeTimeline([msg("m1", "practice")], current);
  assert.equal(hasUnreadFrom({ messages: withHistory }, "practice"), true);
  // ...and the boundary still names the NEWEST message, not the one just found.
  assert.equal(readBoundaryOf(withHistory), "m9");
});
