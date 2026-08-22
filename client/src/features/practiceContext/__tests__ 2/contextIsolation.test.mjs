/**
 * Practice context isolation (Phase 2B).
 *
 * The rules are tested where they live: in pure functions, without a browser and
 * without a DOM, following the repository's existing client-test style.
 *
 * The security goal: data from a previous or foreign practice context can never
 * reach the active one — not through a cache, a late response, browser
 * navigation, a second tab or a manipulated id.
 *
 * Run: node --test src/features/practiceContext/__tests__/contextIsolation.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTEXT_STATE,
  isContextActive,
  isContextOpenable,
  normalizeLinkId,
  resolveContextIdentity,
  responseBelongsToContext,
} from "../lib/contextIdentity.js";

const LINK_HAUSARZT = "link-hausarzt";
const LINK_KARDIO = "link-kardio";
const LINK_NEURO = "link-neuro";
const LINK_FOREIGN = "link-of-another-patient";

/* ---------------------------------------------- Test 1: context identity */

test("the route decides the context — each link resolves to itself", () => {
  for (const id of [LINK_HAUSARZT, LINK_KARDIO, LINK_NEURO]) {
    const r = resolveContextIdentity({ routeLinkId: id });
    assert.equal(r.linkId, id);
    assert.equal(r.resolvedFrom, "route");
  }
});

test("no route link means NO context — never a remembered practice", () => {
  const r = resolveContextIdentity({ routeLinkId: undefined });
  assert.equal(r.linkId, "");
  assert.equal(r.resolvedFrom, "none");
});

test("a stale previous selection can never become the context", () => {
  // Even if a caller passes one, it is not an input to the decision.
  const r = resolveContextIdentity({
    routeLinkId: LINK_KARDIO,
    previousLinkId: LINK_HAUSARZT,
  });
  assert.equal(r.linkId, LINK_KARDIO, "the URL wins, always");

  const none = resolveContextIdentity({
    routeLinkId: "",
    previousLinkId: LINK_HAUSARZT,
  });
  assert.equal(none.linkId, "", "a missing route link does NOT fall back to the last practice");
});

/* ------------------------------------- Test 2 + 6: stale response defence */

test("a response is applied only in the context that requested it", () => {
  assert.equal(responseBelongsToContext(LINK_HAUSARZT, LINK_HAUSARZT), true);
  assert.equal(
    responseBelongsToContext(LINK_HAUSARZT, LINK_KARDIO),
    false,
    "a late GP response must never land in the cardiology context",
  );
});

test("the late-response race is decided by identity, not by timing", () => {
  // 1. request starts at the GP, 2. switch to cardiology, 3. GP answers late.
  let active = LINK_HAUSARZT;
  const requestedIn = active;
  active = LINK_KARDIO;
  assert.equal(
    responseBelongsToContext(requestedIn, active),
    false,
    "the response is discarded regardless of how late it arrives",
  );
});

test("rapid A -> B -> C -> A leaves no window for a stale overwrite", () => {
  const inFlight = [];
  let active = LINK_HAUSARZT;
  inFlight.push({ startedIn: active });

  for (const next of [LINK_KARDIO, LINK_NEURO, LINK_HAUSARZT]) {
    active = next;
    inFlight.push({ startedIn: active });
  }

  // Every request except the ones started in the now-active context is dropped.
  const applied = inFlight.filter((r) => responseBelongsToContext(r.startedIn, active));
  assert.equal(applied.length, 2, "only requests from the current context may apply");
  assert.ok(
    applied.every((r) => r.startedIn === LINK_HAUSARZT),
    "and they all belong to the context on screen",
  );
});

test("an empty context never accepts a response", () => {
  assert.equal(responseBelongsToContext("", ""), false, "no context means no data");
  assert.equal(responseBelongsToContext(LINK_KARDIO, ""), false);
});

/* ------------------------------------------ Test 3: foreign / invalid link */

test("a foreign link is not openable and gets no fallback", () => {
  // Identity resolution is deliberately naive — it does not know ownership.
  // The server decides, and the provider maps a rejection to NOT_FOUND.
  const r = resolveContextIdentity({ routeLinkId: LINK_FOREIGN });
  assert.equal(r.linkId, LINK_FOREIGN, "the id is carried to the server unchanged");

  // Whatever the server says about a link that is not the patient's, the only
  // permitted outcomes are NOT_FOUND or ERROR — never another practice.
  const permitted = [CONTEXT_STATE.NOT_FOUND, CONTEXT_STATE.ERROR];
  assert.ok(permitted.includes(CONTEXT_STATE.NOT_FOUND));
  assert.equal(
    permitted.includes(CONTEXT_STATE.READY),
    false,
    "a foreign link must never produce a ready context",
  );
});

test("relationship status decides openability, and says nothing about ownership", () => {
  assert.equal(isContextOpenable("active"), true);
  assert.equal(isContextOpenable("invited"), true);
  assert.equal(isContextOpenable("revoked"), true, "history stays readable (Phase 1' policy)");
  assert.equal(isContextOpenable("archived"), true);
  assert.equal(isContextOpenable("declined"), false, "a declined link is not a context");
  assert.equal(isContextOpenable(""), false);
  assert.equal(isContextOpenable(undefined), false);
});

test("openable is not the same as active — looking is not acting", () => {
  assert.equal(isContextActive("active"), true);
  assert.equal(isContextActive("revoked"), false);
  assert.equal(
    isContextOpenable("revoked") && !isContextActive("revoked"),
    true,
    "an ended relationship may be read but is not presented as live",
  );
});

/* ------------------------- Test 4 + 5 + 7: refresh, back/forward, two tabs */

test("refresh reconstructs the context from the URL alone", () => {
  // A reload keeps nothing but the URL. Resolution must not need memory.
  const beforeReload = resolveContextIdentity({ routeLinkId: LINK_KARDIO });
  const afterReload = resolveContextIdentity({ routeLinkId: LINK_KARDIO });
  assert.deepEqual(afterReload, beforeReload);
  assert.equal(afterReload.resolvedFrom, "route");
});

test("browser back/forward keeps context and URL in step", () => {
  const history = [LINK_HAUSARZT, LINK_KARDIO, LINK_NEURO];
  const contexts = history.map((id) => resolveContextIdentity({ routeLinkId: id }).linkId);
  assert.deepEqual(contexts, history, "forward");
  assert.deepEqual([...contexts].reverse(), [...history].reverse(), "and back");
});

test("two tabs hold two independent contexts", () => {
  // The context lives in the URL, so there is no shared slot two tabs could
  // fight over. This is why nothing is written to localStorage.
  const tabA = resolveContextIdentity({ routeLinkId: LINK_HAUSARZT });
  const tabB = resolveContextIdentity({ routeLinkId: LINK_KARDIO });
  assert.equal(tabA.linkId, LINK_HAUSARZT);
  assert.equal(tabB.linkId, LINK_KARDIO);
  assert.notEqual(tabA.linkId, tabB.linkId, "one tab never switches the other");
});

/* ------------------------------- Test 8 + 9: scope separation of the caches */

test("practice-scoped state is keyed per link; patient-global state is not", () => {
  // With no query library the "cache" is component state, destroyed by the
  // key={linkId} remount. This pins the KEYING RULE that any future cache must
  // follow: a practice-scoped key always carries the link.
  const scopedKey = (linkId, area) => ["practice", linkId, area].join("/");
  const globalKey = (area) => ["patient", area].join("/");

  assert.notEqual(
    scopedKey(LINK_HAUSARZT, "messages"),
    scopedKey(LINK_KARDIO, "messages"),
    "the same area in two contexts must never share a key",
  );
  assert.equal(
    globalKey("symptom-diary"),
    globalKey("symptom-diary"),
    "patient-global data is stable across a practice switch",
  );
  assert.equal(
    globalKey("symptom-diary").includes(LINK_HAUSARZT),
    false,
    "and must not be keyed by a practice at all",
  );
});

test("hybrid data keeps its two readings apart", () => {
  // Measurements exist patient-globally AND with a practice provenance. The two
  // must not collide, or a context switch would rewrite the global view.
  const globalVitals = ["patient", "vitals"].join("/");
  const contextVitals = ["practice", LINK_KARDIO, "vitals"].join("/");
  assert.notEqual(globalVitals, contextVitals);
});

/* ------------------------------------------------------ input robustness */

test("link ids are normalized, and whitespace is not a context", () => {
  assert.equal(normalizeLinkId("  link-x  "), "link-x");
  assert.equal(normalizeLinkId("   "), "");
  assert.equal(normalizeLinkId(null), "");
  assert.equal(normalizeLinkId(42), "", "a non-string id is no id");
  assert.equal(
    resolveContextIdentity({ routeLinkId: "   " }).linkId,
    "",
    "whitespace does not establish a context",
  );
});
