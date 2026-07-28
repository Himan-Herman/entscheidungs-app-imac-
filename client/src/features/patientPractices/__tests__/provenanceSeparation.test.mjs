/**
 * The patient area keeps three things apart: the patient's own global data, the
 * data of one named care relationship, and data whose origin cannot be
 * established. These tests pin the separation rule itself, without a browser.
 *
 * Run: node --test src/features/patientPractices/__tests__/provenanceSeparation.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { splitByProvenance, recordsForLink } from "../lib/splitByProvenance.js";

const LINK_A = "link-A";
const LINK_B = "link-B";
const LINK_C = "link-C";

/** Resolves only the links the patient actually holds. */
const resolve = (linkId) => {
  const known = { [LINK_A]: "Hausarztpraxis A", [LINK_B]: "Kardiologiepraxis B", [LINK_C]: "Zahnarztpraxis C" };
  const label = known[linkId];
  return label ? { resolved: true, label } : { resolved: false, label: "" };
};

const FIXTURE = [
  { id: "g1", dataScope: "patient_global", contextPracticePatientLinkId: null },
  { id: "g2", dataScope: "patient_global", contextPracticePatientLinkId: null, source: "import" },
  { id: "a1", dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_A },
  { id: "b1", dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_B },
  { id: "c1", dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_C },
  { id: "legacy", dataScope: null, contextPracticePatientLinkId: null },
  { id: "foreign", dataScope: "practice_contextual", contextPracticePatientLinkId: "link-someone-else" },
];

test("1./2. global records land under the patient's own data", () => {
  const { global } = splitByProvenance(FIXTURE, resolve);
  assert.deepEqual(global.map((r) => r.id), ["g1", "g2"]);
});

test("3./4. contextual records land under their own practice", () => {
  const { byLink } = splitByProvenance(FIXTURE, resolve);
  assert.deepEqual(recordsForLink(byLink, LINK_A).map((r) => r.id), ["a1"]);
  assert.deepEqual(recordsForLink(byLink, LINK_B).map((r) => r.id), ["b1"]);
  assert.deepEqual(recordsForLink(byLink, LINK_C).map((r) => r.id), ["c1"]);
});

test("5./6. one practice's records never appear under another", () => {
  const { byLink } = splitByProvenance(FIXTURE, resolve);
  for (const [own, others] of [[LINK_A, [LINK_B, LINK_C]], [LINK_B, [LINK_A, LINK_C]], [LINK_C, [LINK_A, LINK_B]]]) {
    const ids = new Set(recordsForLink(byLink, own).map((r) => r.id));
    for (const other of others) {
      for (const rec of recordsForLink(byLink, other)) {
        assert.ok(!ids.has(rec.id), `${rec.id} appears under two practices`);
      }
    }
  }
});

test("7. legacy and unresolvable records are never labelled as global", () => {
  const { global, unresolved, byLink } = splitByProvenance(FIXTURE, resolve);
  const globalIds = global.map((r) => r.id);
  assert.ok(!globalIds.includes("legacy"), "unclassified data must not be shown as the patient's own");
  assert.ok(!globalIds.includes("foreign"), "a link the patient does not hold must not become global");
  assert.deepEqual(unresolved.map((r) => r.id).sort(), ["foreign", "legacy"]);
  // And it does not silently attach to some practice either.
  for (const list of byLink.values()) {
    for (const rec of list) assert.ok(!["legacy", "foreign"].includes(rec.id));
  }
});

test("every record ends up in exactly one bucket", () => {
  const { global, byLink, unresolved } = splitByProvenance(FIXTURE, resolve);
  const seen = [...global, ...unresolved, ...[...byLink.values()].flat()].map((r) => r.id);
  assert.equal(seen.length, FIXTURE.length, "no record may be dropped or duplicated");
  assert.equal(new Set(seen).size, FIXTURE.length);
});

test("an empty or malformed input never throws", () => {
  for (const input of [null, undefined, [], "nope", 42]) {
    const { global, unresolved, byLink } = splitByProvenance(input, resolve);
    assert.deepEqual(global, []);
    assert.deepEqual(unresolved, []);
    assert.equal(byLink.size, 0);
  }
});

test("a resolver that knows nothing puts everything contextual into unresolved", () => {
  const blind = () => ({ resolved: false, label: "" });
  const { global, byLink, unresolved } = splitByProvenance(FIXTURE, blind);
  assert.deepEqual(global.map((r) => r.id), ["g1", "g2"]);
  assert.equal(byLink.size, 0);
  assert.equal(unresolved.length, 5);
});
