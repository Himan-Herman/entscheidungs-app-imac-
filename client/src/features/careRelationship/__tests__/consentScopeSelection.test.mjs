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

/*
 * Two paths send scopes, and since the request path got its own checkboxes they
 * no longer share one variable:
 *   - accepting a practice's request: `chosen`, that request's own selection
 *     (`requestScopes[link.id]`);
 *   - minting a connect code: `scopes`.
 * Each is asserted on its own terms, and neither may be weaker than before.
 */

test("both submit paths refuse an empty selection — in the handler", () => {
  // A disabled button alone is a hint, not a guarantee.
  assert.match(PAGE, /if \(chosen\.length === 0\) \{/, "accepting a request has no empty-selection guard");
  assert.match(PAGE, /if \(scopes\.length === 0\) \{/, "minting a code has no empty-selection guard");
});

test("both submit buttons are disabled while nothing is selected", () => {
  assert.match(
    PAGE, /disabled=\{busy \|\| chosen\.length === 0\}/,
    "the accept button can be pressed with no scope selected",
  );
  assert.match(
    PAGE, /disabled=\{ccBusy \|\| scopes\.length === 0\}/,
    "the connect-code button can be pressed with no scope selected",
  );
});

test("the submitted scopes are the state, never a substituted default", () => {
  assert.match(PAGE, /acceptPatientLinkRequest\(link\.id, chosen\)/);
  assert.match(PAGE, /createPatientConnectCode\(scopes\)/);
  // The ONLY fallback allowed for a request's selection is the empty list —
  // which the guard above then refuses. Anything else would be a consent
  // nobody gave.
  const reads = PAGE.match(/requestScopes\[link\.id\]\s*\|\|\s*[^;\n]+/g) || [];
  assert.ok(reads.length >= 1, "the request selection is no longer read where expected");
  for (const r of reads) {
    assert.match(r, /\|\|\s*\[\]\s*$/, `a request selection falls back to something other than []: ${r}`);
  }
  assert.equal(
    /(scopes|chosen)\.length\s*(\?|\|\|)\s*[A-Za-z[]/.test(PAGE), false,
    "a fallback substitutes scopes at submit time",
  );
});

test("each request starts with nothing ticked, and never borrows another selection", () => {
  // The per-request map starts empty: no request has any scope until the
  // patient ticks one ON THAT CARD.
  assert.match(PAGE, /const \[requestScopes, setRequestScopes\] = useState\(\{\}\);/);
  // Accepting reads the request's own selection, not the connect-code one.
  const handler = PAGE.slice(PAGE.indexOf("async function handleAcceptRequest"));
  const body = handler.slice(0, handler.indexOf("async function handleDeclineRequest"));
  assert.equal(/\bscopes\b/.test(body.replace(/requestScopes|setRequestScopes/g, "")), false,
    "accepting a request still reads the connect-code selection");
});

test("a request's toggle adds and removes one scope at a time", () => {
  const toggle = PAGE.slice(PAGE.indexOf("function toggleRequestScope"));
  const body = toggle.slice(0, toggle.indexOf("\n  }\n") + 4);
  assert.ok(body.includes("current.includes(scope)"), "toggle no longer inspects the current selection");
  assert.ok(body.includes("filter") && body.includes("[...current, scope]"),
    "toggle should remove on second click and append exactly one on first");
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
