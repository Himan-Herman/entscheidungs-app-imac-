/**
 * Practice chooser and switcher rules (Phase 2D).
 *
 * The logic that decides what the patient sees and where a switch lands is kept
 * in pure functions, so it can be pinned without a browser — the same style the
 * rest of the client tests use. Browser behaviour is covered by the Playwright
 * spec.
 *
 * Run: node --test src/features/practiceContext/__tests__/practiceChooser.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  filterPracticeContexts,
  sortPracticeContexts,
  splitByRelationship,
} from "../lib/practiceContextList.js";
import { switchTargetPath } from "../lib/switchTarget.js";

const ctx = (linkId, over = {}) => ({
  linkId,
  status: "active",
  isActive: true,
  unreadCount: 0,
  lastActivityAt: null,
  practice: { displayName: "Praxis", specialty: null, city: null, logoUrl: null },
  ...over,
});

const HAUSARZT = ctx("link-a", {
  practice: { displayName: "Hausarztpraxis Henkel", specialty: "Allgemeinmedizin", city: "Düsseldorf" },
});
const KARDIO = ctx("link-b", {
  practice: { displayName: "Kardiologie Benrath", specialty: "Kardiologie", city: "Düsseldorf" },
});
const NEURO = ctx("link-c", {
  practice: { displayName: "Neurologie EVK", specialty: "Neurologie", city: "Essen" },
});

/* ------------------------------------------------------------ list shape */

test("a single practice is simply the one card", () => {
  const { active, former } = splitByRelationship([HAUSARZT]);
  assert.equal(active.length, 1);
  assert.equal(former.length, 0);
});

test("former relationships are separated from the practices in use", () => {
  const ended = ctx("link-old", { status: "revoked", isActive: false });
  const { active, former } = splitByRelationship([HAUSARZT, ended, KARDIO]);
  assert.deepEqual(active.map((c) => c.linkId), ["link-a", "link-b"]);
  assert.deepEqual(former.map((c) => c.linkId), ["link-old"]);
});

/* ---------------------------------------------------------------- search */

test("search matches name, specialty and city", () => {
  const all = [HAUSARZT, KARDIO, NEURO];
  assert.deepEqual(filterPracticeContexts(all, "henkel").map((c) => c.linkId), ["link-a"]);
  assert.deepEqual(filterPracticeContexts(all, "kardio").map((c) => c.linkId), ["link-b"]);
  assert.deepEqual(filterPracticeContexts(all, "essen").map((c) => c.linkId), ["link-c"]);
});

test("search is case- and diacritic-insensitive", () => {
  const all = [HAUSARZT, KARDIO];
  assert.equal(filterPracticeContexts(all, "DÜSSELDORF").length, 2);
  assert.equal(filterPracticeContexts(all, "dusseldorf").length, 2, "typing without umlauts works");
});

test("multiple terms narrow rather than widen", () => {
  const all = [HAUSARZT, KARDIO, NEURO];
  assert.deepEqual(
    filterPracticeContexts(all, "kardio düssel").map((c) => c.linkId),
    ["link-b"],
  );
  assert.equal(filterPracticeContexts(all, "kardio essen").length, 0);
});

test("search only ever filters the patient's OWN list", () => {
  // The input is already the server-scoped list; search cannot reach further.
  const own = [HAUSARZT];
  assert.deepEqual(filterPracticeContexts(own, "neurologie"), []);
  assert.equal(
    filterPracticeContexts(own, "").length,
    1,
    "an empty query returns the same list, never more",
  );
});

/* --------------------------------------------------------------- sorting */

test("practices with unread messages come first", () => {
  const withUnread = { ...NEURO, unreadCount: 2 };
  const sorted = sortPracticeContexts([HAUSARZT, KARDIO, withUnread]);
  assert.equal(sorted[0].linkId, "link-c");
});

test("more unread ranks higher", () => {
  const a = { ...HAUSARZT, unreadCount: 1 };
  const b = { ...KARDIO, unreadCount: 5 };
  assert.equal(sortPracticeContexts([a, b])[0].linkId, "link-b");
});

test("the last used practice is only a nudge, never a rule", () => {
  const urgent = { ...NEURO, unreadCount: 3 };
  const sorted = sortPracticeContexts([HAUSARZT, urgent], { lastUsedLinkId: "link-a" });
  assert.equal(
    sorted[0].linkId,
    "link-c",
    "attention beats convenience — unread still wins over last used",
  );

  const calm = sortPracticeContexts([HAUSARZT, KARDIO], { lastUsedLinkId: "link-b" });
  assert.equal(calm[0].linkId, "link-b", "with nothing unread it may lead");
});

test("ordering is stable and alphabetical when nothing else distinguishes", () => {
  const sorted = sortPracticeContexts([NEURO, KARDIO, HAUSARZT]);
  assert.deepEqual(
    sorted.map((c) => c.practice.displayName),
    ["Hausarztpraxis Henkel", "Kardiologie Benrath", "Neurologie EVK"],
  );
});

test("sorting never mutates the input", () => {
  const input = [NEURO, HAUSARZT];
  const before = input.map((c) => c.linkId);
  sortPracticeContexts(input);
  assert.deepEqual(input.map((c) => c.linkId), before);
});

test("many practices stay ordered without special cases", () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    ctx(`link-${i}`, {
      unreadCount: i === 7 ? 4 : 0,
      practice: { displayName: `Praxis ${String(i).padStart(2, "0")}` },
    }),
  );
  const sorted = sortPracticeContexts(many);
  assert.equal(sorted.length, 25);
  assert.equal(sorted[0].linkId, "link-7", "the one with unread leads");
});

/* ------------------------------------------------------- switch routing */

test("switching from a sub-page stays on that sub-page", () => {
  assert.equal(
    switchTargetPath("/patient/practice/link-a/messages", "link-b"),
    "/patient/practice/link-b/messages",
  );
});

test("switching from the practice home lands on the target home", () => {
  assert.equal(switchTargetPath("/patient/practice/link-a", "link-b"), "/patient/practice/link-b");
});

test("a migrated sub-page IS carried across (Phase 2E.1 / 2E.2 / 2E.3)", () => {
  // Appointments, documents and medication plans now exist in every practice
  // context, so a switch keeps you on the same kind of page instead of dropping
  // you at the hub.
  assert.equal(
    switchTargetPath("/patient/practice/link-a/appointments", "link-b"),
    "/patient/practice/link-b/appointments",
  );
  assert.equal(
    switchTargetPath("/patient/practice/link-a/documents", "link-b"),
    "/patient/practice/link-b/documents",
  );
  assert.equal(
    switchTargetPath("/patient/practice/link-a/medication-plans", "link-b"),
    "/patient/practice/link-b/medication-plans",
  );
  assert.equal(
    switchTargetPath("/patient/practice/link-a/erezept", "link-b"),
    "/patient/practice/link-b/erezept",
  );
});

test("a sub-page that does NOT exist in every context falls back to the home", () => {
  // The allowlist matches whole sub-paths only. A deeper route under a portable
  // page is still unknown territory, and so is anything not on the list —
  // carrying either across would produce a dead link.
  assert.equal(
    switchTargetPath("/patient/practice/link-a/documents/doc-1", "link-b"),
    "/patient/practice/link-b",
  );
  assert.equal(
    switchTargetPath("/patient/practice/link-a/messages/deep/thing", "link-b"),
    "/patient/practice/link-b",
  );
  assert.equal(
    switchTargetPath("/patient/practice/link-a/prescriptions", "link-b"),
    "/patient/practice/link-b",
  );
  // A near-miss of a portable name is still not on the list.
  assert.equal(
    switchTargetPath("/patient/practice/link-a/medication-plans/plan-1", "link-b"),
    "/patient/practice/link-b",
  );
  assert.equal(
    switchTargetPath("/patient/practice/link-a/medication-plan", "link-b"),
    "/patient/practice/link-b",
  );
  assert.equal(
    switchTargetPath("/patient/practice/link-a/erezept/entry-1", "link-b"),
    "/patient/practice/link-b",
  );
});

test("a switch never leaves the practice namespace", () => {
  for (const from of [
    "/patient/practice/link-a",
    "/patient/practice/link-a/messages",
    "/patient/messages",
    "/patient",
    "",
  ]) {
    const to = switchTargetPath(from, "link-b");
    assert.ok(
      to.startsWith("/patient/practice/link-b"),
      `${from} -> ${to} must stay inside the target context`,
    );
  }
});

test("an empty target never produces a broken practice URL", () => {
  assert.equal(switchTargetPath("/patient/practice/link-a/messages", ""), "/patient/practice");
  assert.equal(switchTargetPath("/patient/practice/link-a", null), "/patient/practice");
});

test("identity is the link id — same name, different contexts", () => {
  const twinA = ctx("link-1", { practice: { displayName: "Praxis Müller" } });
  const twinB = ctx("link-2", { practice: { displayName: "Praxis Müller" } });
  const sorted = sortPracticeContexts([twinA, twinB]);
  assert.equal(new Set(sorted.map((c) => c.linkId)).size, 2);
  assert.notEqual(
    switchTargetPath("/patient/practice/link-1/messages", "link-2"),
    "/patient/practice/link-1/messages",
    "a switch between same-named practices still changes context",
  );
});
