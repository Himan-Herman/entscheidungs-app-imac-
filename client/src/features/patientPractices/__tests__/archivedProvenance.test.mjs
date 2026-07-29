/**
 * How the patient area presents a practice that no longer exists.
 *
 * The record survived the practice's deletion and is still the patient's. It
 * must read as former — never as the patient's own data, never as if the
 * practice were still active, and never silently hidden.
 *
 * Run: node --test src/features/patientPractices/__tests__/archivedProvenance.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { splitByProvenance, recordsForLink } from "../lib/splitByProvenance.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, "..", rel), "utf8");
/** Sources with comments stripped — an assertion must never be met by prose. */
const strip = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

const badgeSrc = strip(read("components/ProvenanceBadge.jsx"));
const pageSrc = strip(read("pages/PatientDataByPracticePage.jsx"));

const LINK_A = "link-A";
const resolve = (id) => (id === LINK_A ? { resolved: true, label: "Hausarztpraxis A" } : { resolved: false, label: "" });

const FIXTURE = [
  { id: "g", practiceContextState: "none", dataScope: "patient_global", contextPracticePatientLinkId: null },
  { id: "a", practiceContextState: "active", dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_A },
  { id: "arch", practiceContextState: "archived", dataScope: "practice_contextual",
    contextPracticePatientLinkId: null,
    archivedPractice: { displayName: "Kardiologiepraxis B", specialty: "Kardiologie", archivedAt: "2026-07-29T10:00:00.000Z" } },
  { id: "arch-noname", practiceContextState: "archived", dataScope: "practice_contextual",
    contextPracticePatientLinkId: null, archivedPractice: null },
  { id: "unknown", practiceContextState: "unavailable", dataScope: "practice_contextual",
    contextPracticePatientLinkId: null },
];

/* ------------------------------------------------------------- separation */

test("15.–19. each state lands in its own bucket", () => {
  const { global, byLink, archived, unresolved } = splitByProvenance(FIXTURE, resolve);

  assert.deepEqual(global.map((r) => r.id), ["g"], "only the global record");
  assert.deepEqual(recordsForLink(byLink, LINK_A).map((r) => r.id), ["a"]);
  assert.deepEqual(archived.map((r) => r.id).sort(), ["arch", "arch-noname"]);
  assert.deepEqual(unresolved.map((r) => r.id), ["unknown"]);

  // The two claims that matter most.
  assert.ok(!global.some((r) => r.practiceContextState === "archived"),
    "an archived record must never appear under the patient's own data");
  for (const list of byLink.values()) {
    assert.ok(!list.some((r) => r.practiceContextState === "archived"),
      "an archived record must never appear under an active practice");
  }
});

test("nothing is dropped: every record ends up somewhere", () => {
  const { global, byLink, archived, unresolved } = splitByProvenance(FIXTURE, resolve);
  const seen = [...global, ...archived, ...unresolved, ...[...byLink.values()].flat()].map((r) => r.id);
  assert.equal(seen.length, FIXTURE.length, "an archived record is never silently hidden");
  assert.equal(new Set(seen).size, FIXTURE.length);
});

test("a response without practiceContextState still sorts by dataScope", () => {
  const legacy = [
    { id: "g", dataScope: "patient_global", contextPracticePatientLinkId: null },
    { id: "a", dataScope: "practice_contextual", contextPracticePatientLinkId: LINK_A },
    { id: "x", dataScope: null, contextPracticePatientLinkId: null },
  ];
  const { global, byLink, archived, unresolved } = splitByProvenance(legacy, resolve);
  assert.deepEqual(global.map((r) => r.id), ["g"]);
  assert.deepEqual(recordsForLink(byLink, LINK_A).map((r) => r.id), ["a"]);
  assert.deepEqual(archived, []);
  assert.deepEqual(unresolved.map((r) => r.id), ["x"]);
});

/* ------------------------------------------------------------- the badge */

test("20.–22. the badge names each state from its own text", () => {
  // With a snapshot name, without one, and the defensive fallback.
  assert.match(badgeSrc, /state === "archived"/);
  assert.match(badgeSrc, /p\.archivedWith[\s\S]*?\.replace\("\{practice\}", name\)/,
    "a named former practice");
  assert.match(badgeSrc, /:\s*p\.archived\b/, "an unnamed former practice");
  assert.match(badgeSrc, /p\.contextUnavailable/, "an unclassifiable record");
  // And it must not fall through to the "your own data" branch.
  const archIdx = badgeSrc.indexOf('state === "archived"');
  const noneIdx = badgeSrc.indexOf('state === "none"');
  assert.ok(archIdx < noneIdx, "archived is decided before the global branch");
});

test("25. the badge carries an accessible name and a decorative dot", () => {
  assert.match(badgeSrc, /aria-label=\{label\}/, "the former-practice badge names itself");
  assert.match(badgeSrc, /provenance-badge__dot" aria-hidden="true"/);
  assert.ok(!/role="button"|onClick/.test(badgeSrc), "provenance is information, not an action");
  assert.ok(!/title=\{label\}/.test(badgeSrc), "a tooltip must not be the only source");
});

test("a date that cannot be localised is left out rather than shown raw", () => {
  assert.match(badgeSrc, /Number\.isNaN\(d\.getTime\(\)\)/);
  assert.match(badgeSrc, /if \(!value\) return ""/);
});

/* --------------------------------------------------------------- the page */

test("17. the page has a separate section for former practices", () => {
  assert.match(pageSrc, /archived-practices-heading/);
  assert.match(pageSrc, /t\.practices\.archivedTitle/);
  assert.match(pageSrc, /split\[sec\.key\]\?\.archived/);
});

test("former practices are not offered as an active workspace", () => {
  // The switcher is the tablist; the archived section must not feed it.
  const switcherCall = pageSrc.slice(pageSrc.indexOf("<PracticeSwitcher"), pageSrc.indexOf("</>"));
  assert.ok(!switcherCall.includes("archived"), "a deleted practice is not a tab");
  const archIdx = pageSrc.indexOf("archived-practices-heading");
  assert.ok(!/role="tab(list|panel)?"/.test(pageSrc.slice(archIdx)),
    "the archived section carries no tab semantics");
});

test("24. all four data types use the same badge", () => {
  const pages = [
    "vitals/pages/VitalsPage.jsx",
    "vaccinations/pages/VaccinationPassPage.jsx",
    "healthHistory/pages/HealthHistoryPage.jsx",
  ];
  const featureFile = (rel) => join(here, "..", "..", rel);
  for (const rel of pages) {
    const src = readFileSync(featureFile(rel), "utf8");
    assert.match(src, /import ProvenanceBadge from/, `${rel}: not using the shared badge`);
    assert.match(src, /practiceContextState=\{entry\.practiceContextState\}/, `${rel}: state not passed`);
    assert.match(src, /archivedPractice=\{entry\.archivedPractice\}/, `${rel}: snapshot not passed`);
  }
  // Health history covers both allergies and diagnoses.
  const hh = readFileSync(featureFile(pages[2]), "utf8");
  assert.equal((hh.match(/practiceContextState=\{entry\.practiceContextState\}/g) || []).length, 2);
});

/* ------------------------------------------------------ 23. minimisation */

test("23. no historical identifier reaches the DOM", () => {
  for (const [name, src] of [["badge", badgeSrc], ["page", pageSrc]]) {
    for (const secret of [
      "archivedPracticeContextId", "originalPracticePatientLinkId",
      "originalPracticeProfileId", "patientUserId", "archiveReason",
    ]) {
      assert.ok(!src.includes(secret), `${name} references ${secret}`);
    }
    assert.doesNotMatch(src, /data-[a-z-]*id=/, `${name} writes an id into a data attribute`);
    assert.doesNotMatch(src, /console\.(log|debug)/, `${name} has debug output`);
  }
  // The archived section groups by data type, never by practice name.
  const archSection = pageSrc.slice(pageSrc.indexOf("archived-practices-heading"));
  assert.ok(!/displayName\]/.test(archSection), "grouping by name would merge two different practices");
});
