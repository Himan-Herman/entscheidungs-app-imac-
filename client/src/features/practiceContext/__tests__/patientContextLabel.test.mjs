/**
 * Telling two relationships with the SAME practice apart (Phase 2F.0).
 *
 * Pure logic only: the label text, the search that has to find it, and the
 * ordering that must not depend on what the database happened to return.
 *
 * Run: node --test src/features/practiceContext/__tests__/patientContextLabel.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  patientContextLabel,
  comparePatientContextTieBreak,
} from "../lib/patientContextLabel.js";
import {
  filterPracticeContexts,
  sortPracticeContexts,
} from "../lib/practiceContextList.js";

const t = { contextOwnAccount: "Eigenes Konto", contextForProfile: "Für {name}" };

/** Two relationships, one practice — identical in every displayed field but one. */
const A1 = {
  linkId: "link-a1",
  patientProfileName: null,
  unreadCount: 0,
  lastActivityAt: null,
  isActive: true,
  practice: { displayName: "Hausarztpraxis Henkel", specialty: "Allgemeinmedizin", city: "Düsseldorf" },
};
const A2 = {
  ...A1,
  linkId: "link-a2",
  patientProfileName: "Max Muster",
};

/* ==================================================================== Label */

test("the account holder's own relationship is named, not left blank", () => {
  // Blank would mean the own-account card is identified by ABSENCE, and absence
  // is a poor thing to hang a medication plan on.
  assert.equal(patientContextLabel(null, t), "Eigenes Konto");
  assert.equal(patientContextLabel(undefined, t), "Eigenes Konto");
  assert.equal(patientContextLabel("   ", t), "Eigenes Konto");
});

test("a family relationship names the person it is for", () => {
  assert.equal(patientContextLabel("Max Muster", t), "Für Max Muster");
});

test("two links to one practice never produce the same label", () => {
  assert.notEqual(
    patientContextLabel(A1.patientProfileName, t),
    patientContextLabel(A2.patientProfileName, t),
  );
});

/* =================================================================== Search */

test("searching the person narrows to the right relationship", () => {
  const found = filterPracticeContexts([A1, A2], "max", t);
  assert.deepEqual(found.map((c) => c.linkId), ["link-a2"]);
});

test("the account-holder wording is searchable in the shown language", () => {
  const found = filterPracticeContexts([A1, A2], "eigenes", t);
  assert.deepEqual(found.map((c) => c.linkId), ["link-a1"]);
});

test("searching the practice still returns both relationships", () => {
  const found = filterPracticeContexts([A1, A2], "henkel", t);
  assert.deepEqual(found.map((c) => c.linkId).sort(), ["link-a1", "link-a2"]);
});

test("search stays local — nothing is looked up beyond the given contexts", () => {
  assert.deepEqual(filterPracticeContexts([], "henkel", t), []);
  assert.deepEqual(filterPracticeContexts([A1, A2], "kardiologie", t), []);
});

/* ================================================================= Ordering */

test("two otherwise identical cards keep a stable, non-random order", () => {
  const forwards = sortPracticeContexts([A1, A2]).map((c) => c.linkId);
  const backwards = sortPracticeContexts([A2, A1]).map((c) => c.linkId);
  assert.deepEqual(
    forwards,
    backwards,
    "input order must not decide the output order",
  );
});

test("the tie-break prefers what the patient can see", () => {
  // The own-account label sorts before a named profile because its
  // patientProfileName is empty; either way the result is deterministic and
  // linkId only settles a true draw.
  assert.ok(comparePatientContextTieBreak(A1, A2) !== 0);
  assert.equal(
    comparePatientContextTieBreak({ ...A1 }, { ...A1 }),
    0,
    "identical relationships compare equal",
  );
  assert.ok(
    comparePatientContextTieBreak(
      { patientProfileName: "Max", linkId: "aaa" },
      { patientProfileName: "Max", linkId: "bbb" },
    ) < 0,
    "linkId is the last resort and is never displayed",
  );
});

test("unread still outranks the tie-break", () => {
  const unreadA2 = { ...A2, unreadCount: 3 };
  const order = sortPracticeContexts([A1, unreadA2]).map((c) => c.linkId);
  assert.deepEqual(order, ["link-a2", "link-a1"], "what needs attention stays first");
});

/* ============================================================== Identity */

test("the label is never an identity — the link id stays the key", () => {
  // Same displayed label, different relationships: nothing may collapse them.
  const twins = [
    { ...A1, linkId: "link-x" },
    { ...A1, linkId: "link-y" },
  ];
  const sorted = sortPracticeContexts(twins);
  assert.equal(sorted.length, 2, "two relationships stay two");
  assert.deepEqual(sorted.map((c) => c.linkId), ["link-x", "link-y"]);
});
