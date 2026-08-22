/**
 * Original and translation, client side (Phase 4A).
 *
 * Tested as pure functions, without a browser and without a DOM, following the
 * repository's existing client-test style.
 *
 * The client's part is narrow: it remembers which translation belongs to which
 * WORDING of which message, and it forgets one the moment that wording changes.
 * Everything else — whether a translation may be made at all, and what it says —
 * is the server's.
 *
 * Run: node --test src/features/practiceContext/__tests__/messageTranslationState.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
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

/* --------------------------------------------- Test 1: what the key binds */

test("a translation is bound to a message, a wording and a language", () => {
  const m = msg("m1");
  const fr = translationKey(m, "fr");
  const it = translationKey(m, "it");
  const other = translationKey(msg("m2"), "fr");

  assert.notEqual(fr, it, "two languages are two translations");
  assert.notEqual(fr, other, "two messages are two translations");
});

test("editing a message changes its key, so the old translation is not found", () => {
  const before = msg("m1");
  const after = msg("m1", { body: "corrected", editedAt: "2026-08-22T11:00:00.000Z" });
  assert.notEqual(translationKey(before, "fr"), translationKey(after, "fr"));
});

test("the server's fingerprint wins over the local stand-in", () => {
  const m = msg("m1");
  const local = translationKey(m, "fr");
  const fromServer = translationKey(m, "fr", "abc123");
  assert.notEqual(local, fromServer);
  // Two different servers' answers for the same wording agree with each other.
  assert.equal(fromServer, translationKey(msg("m1", { body: "anything" }), "fr", "abc123"));
});

/* ------------------------------------------ Test 2: what may be shown */

test("a translation is shown only for the wording that is on screen", () => {
  const m = msg("m1");
  const store = { [translationKey(m, "fr")]: { status: "done", text: "Bonjour" } };

  assert.equal(translationFor(store, m, "fr").text, "Bonjour");

  const edited = msg("m1", { body: "neu", editedAt: "2026-08-22T11:00:00.000Z" });
  assert.equal(
    translationFor(store, edited, "fr"),
    null,
    "the translation of the previous wording must not appear under the new one",
  );
});

test("a withdrawn message shows no translation, whatever is in memory", () => {
  const m = msg("m1");
  const store = { [translationKey(m, "fr")]: { status: "done", text: "Bonjour" } };
  const withdrawn = { ...m, withdrawnAt: "2026-08-22T12:00:00.000Z" };

  assert.equal(
    translationFor(store, withdrawn, "fr"),
    null,
    "a retracted sentence must not be readable in another language",
  );
});

test("asking in a language nothing was translated into yields nothing", () => {
  const m = msg("m1");
  const store = { [translationKey(m, "fr")]: { status: "done", text: "Bonjour" } };
  assert.equal(translationFor(store, m, "it"), null);
});

/* ------------------------------------------- Test 3: forgetting */

test("a changed message loses every translation it had", () => {
  const a = msg("m1");
  const b = msg("m2");
  const store = {
    [translationKey(a, "fr")]: { status: "done", text: "A-fr" },
    [translationKey(a, "it")]: { status: "done", text: "A-it" },
    [translationKey(b, "fr")]: { status: "done", text: "B-fr" },
  };

  const next = forgetTranslationsOf(store, "m1");
  assert.deepEqual(Object.keys(next), [translationKey(b, "fr")]);
  assert.equal(JSON.stringify(next).includes("A-fr"), false);
  assert.equal(JSON.stringify(next).includes("A-it"), false);
});

test("forgetting a message that has no translations changes nothing", () => {
  const store = { [translationKey(msg("m1"), "fr")]: { status: "done", text: "x" } };
  assert.equal(forgetTranslationsOf(store, "m2"), store, "no needless rebuild");
  assert.deepEqual(forgetTranslationsOf(null, "m1"), {});
  assert.deepEqual(forgetTranslationsOf({}, ""), {});
});

test("a message id that is a prefix of another is not confused with it", () => {
  // "m1" must not sweep away "m10". The separator in the key is what prevents
  // it, and this pins that down.
  const short = msg("m1");
  const long = msg("m10");
  const store = {
    [translationKey(short, "fr")]: { status: "done", text: "short" },
    [translationKey(long, "fr")]: { status: "done", text: "long" },
  };
  const next = forgetTranslationsOf(store, "m1");
  assert.deepEqual(Object.keys(next), [translationKey(long, "fr")]);
});

/* --------------------------------------- Test 4: what may be offered */

test("a withdrawn message is never offered a translation", () => {
  assert.equal(isTranslatable(msg("m1", { withdrawnAt: "2026-08-22T12:00:00.000Z" })), false);
});

test("a message with no text left is not offered one either", () => {
  assert.equal(isTranslatable(msg("m1", { body: "" })), false);
  assert.equal(isTranslatable(msg("m1", { body: "   " })), false);
  assert.equal(isTranslatable({ id: "m1" }), false);
});

test("an ordinary message is offered a translation, own or received", () => {
  assert.equal(isTranslatable(msg("m1")), true);
  assert.equal(isTranslatable(msg("m2", { senderType: "patient" })), true);
  // A read message too: reading something does not stop it being translatable.
  assert.equal(isTranslatable(msg("m3", { readAt: "2026-08-22T11:00:00.000Z" })), true);
});

test("an edited message is still translatable — into the new wording", () => {
  const edited = msg("m1", { body: "korrigiert", editedAt: "2026-08-22T11:00:00.000Z" });
  assert.equal(isTranslatable(edited), true);
  assert.equal(translationFor({}, edited, "fr"), null, "and starts without one");
});

/* ------------------------------------ Test 5: states along the way */

test("loading and error states are held per translation, not per message", () => {
  const m = msg("m1");
  const store = {
    [translationKey(m, "fr")]: { status: "loading" },
    [translationKey(m, "it")]: { status: "error", message: "failed", retryable: true },
  };
  assert.equal(translationFor(store, m, "fr").status, "loading");
  assert.equal(translationFor(store, m, "it").status, "error");
  assert.equal(translationFor(store, m, "es"), null, "a third language has no state yet");
});

test("a stale answer cannot land on a message that has since changed", () => {
  // The answer arrives keyed to the wording it was asked about. The message on
  // screen has moved on, so the lookup for it simply finds nothing.
  const asked = msg("m1");
  const arrived = { [translationKey(asked, "fr")]: { status: "done", text: "old" } };
  const onScreen = msg("m1", { body: "new", editedAt: "2026-08-22T11:30:00.000Z" });
  assert.equal(translationFor(arrived, onScreen, "fr"), null);
});
