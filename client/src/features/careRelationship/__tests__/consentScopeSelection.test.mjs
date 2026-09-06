/**
 * Consent is only what the patient actually ticked.
 *
 * The rule this file guards is small and easy to break by accident: no scope may
 * be selected unless a person selected it. A pre-ticked box, a "select all"
 * convenience, or a silent fallback at submit time would each produce a consent
 * record for a choice nobody made — and every one of them would look fine in a
 * screenshot. So the source is read and asserted directly.
 *
 * Run: node --test client/src/features/careRelationship/__tests__/consentScopeSelection.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(here, "../pages/PatientPracticeLinksPage.jsx"), "utf8");

test("the initial selection is empty — nothing is pre-ticked", () => {
  const decl = PAGE.match(/const DEFAULT_CONNECT_SCOPES = (\[[^\]]*\]);/);
  assert.ok(decl, "DEFAULT_CONNECT_SCOPES is gone — has the default moved?");
  assert.equal(
    decl[1].replace(/\s/g, ""), "[]",
    `scopes are pre-selected: ${decl[1]}`,
  );

  // And it really is what the state starts from.
  assert.match(PAGE, /useState\(DEFAULT_CONNECT_SCOPES\)/);
});

test("there is no select-all shortcut", () => {
  assert.equal(/selectAll|CONNECT_SCOPE_OPTIONS\.map\(\s*\(?o\w*\)?\s*=>\s*o\w*\.scope\s*\)/.test(PAGE), false,
    "a select-all path exists — consent must stay item by item");
});

test("both submit paths refuse an empty selection", () => {
  // Two places send scopes: accepting a practice's link, and minting a connect
  // code. Both must refuse, and both must refuse in the handler — a disabled
  // button alone is a hint, not a guarantee.
  const guards = PAGE.match(/if \(scopes\.length === 0\) \{/g) || [];
  assert.equal(guards.length, 2, `expected a guard in both handlers, found ${guards.length}`);
});

test("both submit buttons are disabled while nothing is selected", () => {
  assert.match(
    PAGE, /disabled=\{busyId === link\.id \|\| scopes\.length === 0\}/,
    "the accept button can be pressed with no scope selected",
  );
  assert.match(
    PAGE, /disabled=\{ccBusy \|\| scopes\.length === 0\}/,
    "the connect-code button can be pressed with no scope selected",
  );
});

test("the submitted scopes are the state, never a substituted default", () => {
  // `scopes` goes to the server verbatim. A `scopes.length ? scopes : SOMETHING`
  // anywhere on these calls would reintroduce an unchosen consent.
  assert.match(PAGE, /acceptPatientLinkRequest\(link\.id, scopes\)/);
  assert.match(PAGE, /createPatientConnectCode\(scopes\)/);
  assert.equal(
    /scopes\.length\s*(\?|\|\|)\s*[A-Za-z[]/.test(PAGE), false,
    "a fallback substitutes scopes at submit time",
  );
});

test("toggling adds and removes one scope at a time", () => {
  // The reducer is the only way a scope can enter the selection.
  const toggle = PAGE.slice(PAGE.indexOf("setScopes((prev)"));
  assert.ok(toggle.includes("prev.includes"), "toggle no longer inspects the previous selection");
  assert.ok(
    toggle.includes("filter") && toggle.includes("[...prev"),
    "toggle should remove on second click and append on first",
  );
});
