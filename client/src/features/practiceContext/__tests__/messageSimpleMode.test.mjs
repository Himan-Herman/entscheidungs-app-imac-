/**
 * The two renderings, client side (Phase 4B).
 *
 * A faithful translation and a plainer rewrite are different answers to
 * different questions. The client's job is to keep them apart — never to show
 * one where the other was asked for, never to let either stand in for the
 * message itself, and to forget both the moment the message changes.
 *
 * Run: node --test src/features/practiceContext/__tests__/messageSimpleMode.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  RENDERING_MODES,
  forgetTranslationsOf,
  isTranslatable,
  translationFor,
  translationKey,
} from "../lib/messageTranslationState.js";

const msg = (id, extra = {}) => ({
  id,
  senderType: "practice",
  body: `body of ${id}`,
  createdAt: "2026-08-22T10:00:00.000Z",
  readAt: null,
  editedAt: null,
  withdrawnAt: null,
  ...extra,
});

const NORMAL = RENDERING_MODES.NORMAL;
const SIMPLE = RENDERING_MODES.SIMPLE;

/* ------------------------------------- Test 1: the two are never confused */

test("a translation and a plainer wording are different entries", () => {
  const m = msg("m1");
  assert.notEqual(
    translationKey(m, "de", undefined, NORMAL),
    translationKey(m, "de", undefined, SIMPLE),
  );
});

test("a translation is never served where a plainer wording was asked for", () => {
  const m = msg("m1");
  const store = {
    [translationKey(m, "fr", undefined, NORMAL)]: { status: "done", text: "traduction" },
  };

  assert.equal(translationFor(store, m, "fr", NORMAL).text, "traduction");
  assert.equal(
    translationFor(store, m, "fr", SIMPLE),
    null,
    "the faithful translation must not answer for the plainer wording",
  );
});

test("...and the other way round", () => {
  const m = msg("m1");
  const store = {
    [translationKey(m, "de", undefined, SIMPLE)]: { status: "done", text: "einfacher" },
  };
  assert.equal(translationFor(store, m, "de", SIMPLE).text, "einfacher");
  assert.equal(translationFor(store, m, "de", NORMAL), null);
});

test("both can be held at once, for the same message and language", () => {
  const m = msg("m1");
  const store = {
    [translationKey(m, "de", undefined, NORMAL)]: { status: "done", text: "wörtlich" },
    [translationKey(m, "de", undefined, SIMPLE)]: { status: "done", text: "einfacher" },
  };
  assert.equal(translationFor(store, m, "de", NORMAL).text, "wörtlich");
  assert.equal(translationFor(store, m, "de", SIMPLE).text, "einfacher");
});

test("the default rendering is the faithful one", () => {
  const m = msg("m1");
  assert.equal(translationKey(m, "de"), translationKey(m, "de", undefined, NORMAL));
  const store = { [translationKey(m, "de", undefined, NORMAL)]: { status: "done", text: "x" } };
  assert.equal(translationFor(store, m, "de").text, "x");
});

/* ------------------------------------- Test 2: language stays independent */

test("changing the language changes the entry in both modes", () => {
  const m = msg("m1");
  assert.notEqual(
    translationKey(m, "de", undefined, SIMPLE),
    translationKey(m, "fr", undefined, SIMPLE),
  );
  const store = {
    [translationKey(m, "de", undefined, SIMPLE)]: { status: "done", text: "einfacher" },
  };
  assert.equal(translationFor(store, m, "fr", SIMPLE), null);
});

test("a plainer wording in the message's own language is an ordinary case", () => {
  // German original, German rewrite: nothing about the key treats that as
  // special, and nothing forces a translation.
  const m = msg("m1");
  const key = translationKey(m, "de", undefined, SIMPLE);
  const store = { [key]: { status: "done", text: "Die Untersuchung war ohne Befund." } };
  assert.equal(translationFor(store, m, "de", SIMPLE).text, "Die Untersuchung war ohne Befund.");
});

/* ------------------------------------- Test 3: edit and withdraw */

test("editing invalidates BOTH renderings", () => {
  const before = msg("m1");
  const store = {
    [translationKey(before, "de", undefined, NORMAL)]: { status: "done", text: "alt" },
    [translationKey(before, "de", undefined, SIMPLE)]: { status: "done", text: "alt einfach" },
  };
  const after = msg("m1", { body: "neu", editedAt: "2026-08-22T11:00:00.000Z" });

  assert.equal(translationFor(store, after, "de", NORMAL), null);
  assert.equal(translationFor(store, after, "de", SIMPLE), null);
});

test("forgetting a message drops every rendering of it, in every language", () => {
  const a = msg("m1");
  const b = msg("m2");
  const store = {
    [translationKey(a, "de", undefined, NORMAL)]: { status: "done", text: "A de" },
    [translationKey(a, "de", undefined, SIMPLE)]: { status: "done", text: "A de simple" },
    [translationKey(a, "fr", undefined, SIMPLE)]: { status: "done", text: "A fr simple" },
    [translationKey(b, "de", undefined, SIMPLE)]: { status: "done", text: "B de simple" },
  };

  const next = forgetTranslationsOf(store, "m1");
  assert.deepEqual(Object.keys(next), [translationKey(b, "de", undefined, SIMPLE)]);
  assert.equal(JSON.stringify(next).includes("A de"), false);
  assert.equal(JSON.stringify(next).includes("A fr simple"), false);
});

test("a withdrawn message shows neither rendering", () => {
  const m = msg("m1");
  const store = {
    [translationKey(m, "de", undefined, NORMAL)]: { status: "done", text: "wörtlich" },
    [translationKey(m, "de", undefined, SIMPLE)]: { status: "done", text: "einfacher" },
  };
  const withdrawn = { ...m, withdrawnAt: "2026-08-22T12:00:00.000Z" };

  assert.equal(translationFor(store, withdrawn, "de", NORMAL), null);
  assert.equal(translationFor(store, withdrawn, "de", SIMPLE), null);
});

test("a withdrawn message is offered neither rendering", () => {
  assert.equal(isTranslatable(msg("m1", { withdrawnAt: "2026-08-22T12:00:00.000Z" })), false);
});

/* ------------------------------------- Test 4: states along the way */

test("the two renderings have independent loading and error states", () => {
  const m = msg("m1");
  const store = {
    [translationKey(m, "de", undefined, NORMAL)]: { status: "done", text: "wörtlich" },
    [translationKey(m, "de", undefined, SIMPLE)]: { status: "loading" },
  };
  assert.equal(translationFor(store, m, "de", NORMAL).status, "done");
  assert.equal(translationFor(store, m, "de", SIMPLE).status, "loading");
});

test("a rendering refused as unsafe is not offered a retry", () => {
  // Trying again at something the server judged unsafe would just repeat it.
  const m = msg("m1");
  const store = {
    [translationKey(m, "de", undefined, SIMPLE)]: {
      status: "error",
      message: "Eine verständlichere Darstellung konnte nicht sicher erstellt werden.",
      retryable: false,
    },
  };
  const state = translationFor(store, m, "de", SIMPLE);
  assert.equal(state.status, "error");
  assert.equal(state.retryable, false);
});

test("a failed plainer wording leaves the translation alone", () => {
  const m = msg("m1");
  const store = {
    [translationKey(m, "de", undefined, NORMAL)]: { status: "done", text: "wörtlich" },
    [translationKey(m, "de", undefined, SIMPLE)]: { status: "error", message: "x", retryable: true },
  };
  assert.equal(translationFor(store, m, "de", NORMAL).text, "wörtlich");
});

test("a stale answer cannot land on a message that has since changed", () => {
  const asked = msg("m1");
  const arrived = {
    [translationKey(asked, "de", undefined, SIMPLE)]: { status: "done", text: "alt" },
  };
  const onScreen = msg("m1", { body: "neu", editedAt: "2026-08-22T11:30:00.000Z" });
  assert.equal(translationFor(arrived, onScreen, "de", SIMPLE), null);
});

test("the server's fingerprint keys both modes the same way", () => {
  const m = msg("m1");
  const normal = translationKey(m, "de", "abc123", NORMAL);
  const plain = translationKey(m, "de", "abc123", SIMPLE);
  assert.notEqual(normal, plain, "the same wording in two renderings is two entries");
  assert.ok(normal.endsWith(`|${NORMAL}`));
  assert.ok(plain.endsWith(`|${SIMPLE}`));
});
