/**
 * The header badge hears about a notice being read.
 *
 * ── What broke ──────────────────────────────────────────────────────────────
 * The unread count is fetched by the notification centre and by nobody else.
 * It was fetched once — on login, and on a mode or practice switch — so
 * opening the one unread notice left a red 1 in the header until the page was
 * reloaded.
 *
 * ── What is asserted here ───────────────────────────────────────────────────
 * The signal itself, and the wiring: that the pages which mark something read
 * announce it, and that the badge listens. The arithmetic is deliberately NOT
 * here — the count comes from the server, and the server side is covered in
 * verifyInboxReadOnOpen.test.js. A second place computing the number is the
 * thing this design avoids, so a test asserting client-side arithmetic would
 * be testing a mistake.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The module reads `window`; node:test has none. */
class FakeWindow {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, fn) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(type, fn) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn));
  }
  dispatchEvent(ev) {
    for (const fn of this.listeners.get(ev.type) ?? []) fn(ev);
    return true;
  }
}

globalThis.window = new FakeWindow();
globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};

const { notifyUnreadChanged, onUnreadChanged } = await import("../notificationSignal.js");

/* ───────────────────────────────────────────────────── the signal */

test("a subscriber is told when the count may have changed", () => {
  let called = 0;
  const off = onUnreadChanged(() => {
    called += 1;
  });
  try {
    notifyUnreadChanged();
    assert.equal(called, 1);
    notifyUnreadChanged();
    assert.equal(called, 2, "a second change was not announced");
  } finally {
    off();
  }
});

test("unsubscribing really stops it", () => {
  // Otherwise a notification centre unmounted on a mode switch keeps
  // re-fetching for a context it no longer belongs to.
  let called = 0;
  const off = onUnreadChanged(() => {
    called += 1;
  });
  notifyUnreadChanged();
  off();
  notifyUnreadChanged();
  assert.equal(called, 1, "the handler ran after unsubscribing");
});

test("several subscribers all hear it", () => {
  const seen = [];
  const offs = [
    onUnreadChanged(() => seen.push("a")),
    onUnreadChanged(() => seen.push("b")),
  ];
  try {
    notifyUnreadChanged();
    assert.deepEqual(seen, ["a", "b"]);
  } finally {
    offs.forEach((off) => off());
  }
});

test("the signal carries no count", () => {
  /*
   * The point of the design. If a number ever travelled on this event, two
   * places would own the badge and could disagree; the owner is supposed to
   * re-ask the server instead.
   */
  let payload = "not called";
  const off = onUnreadChanged((ev) => {
    payload = ev?.detail;
  });
  try {
    notifyUnreadChanged();
    assert.equal(payload, undefined, "the signal is carrying data it should not");
  } finally {
    off();
  }
});

/* ──────────────────────────────────── the wiring, in the real files */

const read = (rel) => readFileSync(join(SRC, rel), "utf8");

test("every place that marks something read announces it", () => {
  const SITES = [
    ["practice inbox detail", "features/practiceInbox/pages/PracticeInboxDetailPage.jsx"],
    ["patient inbox", "features/patientInbox/pages/PatientInboxPage.jsx"],
  ];
  for (const [label, rel] of SITES) {
    assert.match(read(rel), /notifyUnreadChanged\(\)/, `${label} no longer announces the change`);
  }
});

test("the notification centre listens, and re-fetches rather than counting", () => {
  const src = read("features/notificationCenter/components/NotificationCenter.jsx");
  assert.match(src, /onUnreadChanged\(load\)/, "the badge no longer listens");
  // It must re-run its own loader. Doing arithmetic on the badge here would be
  // the second writer this design exists to avoid.
  assert.ok(
    !/setSummary\(\s*\(?\w*\)?\s*=>/.test(src),
    "the badge is now computing its own number instead of asking the server",
  );
});

test("opening a practice notice marks it read, and only when it is new", () => {
  const src = read("features/practiceInbox/pages/PracticeInboxDetailPage.jsx");
  assert.match(
    src,
    /item\.status !== "new"/,
    "the detail page no longer restricts the mutation to unread notices",
  );
  assert.match(src, /patchPracticeInboxRead\(itemId, practiceId\)/);
  // The announcement must follow a confirmed response, not precede it.
  const markBlock = src.slice(src.indexOf('item.status !== "new"'));
  const okAt = markBlock.indexOf("data.item");
  const notifyAt = markBlock.indexOf("notifyUnreadChanged()");
  assert.ok(okAt > -1 && notifyAt > okAt, "the badge is told before the server confirms");
});

test("the inbox LIST still marks nothing read", () => {
  // Visiting the list is not reading. The bug was the opposite direction, and
  // over-correcting into "loading the page clears the badge" would be worse
  // than what was reported.
  const src = read("features/practiceInbox/pages/PracticeInboxListPage.jsx");
  assert.ok(
    !/patchPracticeInboxRead|notifyUnreadChanged/.test(src),
    "the list page now mutates read state",
  );
});

test("no weak private copy of the internal-path check remains", () => {
  /*
   * Found while tracing this bug, and corrected here: both inbox pages carried
   * their own `isSafeInternalUrl` using `startsWith("/") && !startsWith("//")`
   * — the exact check proven insufficient in 6c.1, which accepts
   * `/\evil.example` and leaves the origin. Phase 6c.1 reported that no client
   * guard existed; that was wrong, and these two were it.
   */
  for (const rel of [
    "features/practiceInbox/pages/PracticeInboxDetailPage.jsx",
    "features/patientInbox/pages/PatientInboxPage.jsx",
  ]) {
    const src = read(rel);
    assert.ok(!/isSafeInternalUrl/.test(src), `${rel} still has its own path check`);
    assert.match(src, /safeInternalPath/, `${rel} does not use the canonical check`);
  }
});
