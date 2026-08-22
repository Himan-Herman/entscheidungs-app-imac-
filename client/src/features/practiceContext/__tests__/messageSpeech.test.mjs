/**
 * Dictation and reading aloud, client side (Phase 4C).
 *
 * Tested as pure functions, without a browser and without a microphone,
 * following the repository's existing client-test style.
 *
 * Two decisions carry this phase and both live here: what a transcript does to
 * text someone has already written, and which text may be read aloud for a
 * message whose content has since changed.
 *
 * Run: node --test src/features/practiceContext/__tests__/messageSpeech.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DICTATION_STATES,
  canDictate,
  dictationFailure,
  insertTranscript,
  isCapturing,
} from "../lib/dictationState.js";
import {
  SPEECH_SOURCES,
  availableSpeechSources,
  isSpeaking,
  speechSourceFor,
} from "../lib/messageSpeechState.js";
import { RENDERING_MODES, translationKey } from "../lib/messageTranslationState.js";

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

const T = {
  micDenied: "mic denied",
  micUnavailable: "no mic",
  dictationUnavailable: "unavailable",
  dictationTooLong: "too long",
  dictationFailed: "failed",
};

/* ------------------------------------ Test 1: nothing written is lost */

test("dictating into an empty composer just fills it", () => {
  const out = insertTranscript("", "Guten Tag", { start: 0, end: 0 });
  assert.equal(out.text, "Guten Tag");
  assert.equal(out.caret, "Guten Tag".length);
});

test("dictating never replaces text that is already there", () => {
  const existing = "Ich habe eine Frage.";
  const out = insertTranscript(existing, "Seit gestern geht es mir schlechter.", {
    start: existing.length,
    end: existing.length,
  });
  assert.ok(out.text.startsWith(existing), "what was written must survive");
  assert.ok(out.text.includes("Seit gestern geht es mir schlechter."));
});

test("the transcript lands at the caret, not at the end", () => {
  const existing = "Guten Tag. Viele Grüße";
  const at = "Guten Tag. ".length;
  const out = insertTranscript(existing, "Mir geht es besser.", { start: at, end: at });
  assert.equal(out.text, "Guten Tag. Mir geht es besser. Viele Grüße");
});

test("a selection is replaced, because that is what a selection means", () => {
  const existing = "Guten Tag FALSCH Viele Grüße";
  const start = "Guten Tag ".length;
  const end = start + "FALSCH".length;
  const out = insertTranscript(existing, "richtig", { start, end });
  assert.equal(out.text, "Guten Tag richtig Viele Grüße");
});

test("spacing is fixed only where it is actually missing", () => {
  assert.equal(insertTranscript("Hallo", "Welt", { start: 5, end: 5 }).text, "Hallo Welt");
  assert.equal(insertTranscript("Hallo ", "Welt", { start: 6, end: 6 }).text, "Hallo Welt");
  assert.equal(insertTranscript("Hallo Welt", "schön", { start: 6, end: 6 }).text, "Hallo schön Welt");
});

test("an empty or whitespace transcript changes nothing", () => {
  const existing = "Bereits geschrieben";
  for (const transcript of ["", "   ", null, undefined]) {
    assert.equal(insertTranscript(existing, transcript).text, existing);
  }
});

test("a missing or nonsensical caret appends rather than corrupting", () => {
  const existing = "Text";
  for (const caret of [undefined, null, { start: -5 }, { start: 999 }, { start: "x" }]) {
    const out = insertTranscript(existing, "mehr", caret);
    assert.ok(out.text.startsWith(existing), `caret ${JSON.stringify(caret)} lost text`);
    assert.ok(out.text.includes("mehr"));
  }
});

/* ------------------------------------ Test 2: failures a person can act on */

test("a denied microphone is stated, and not offered a retry", () => {
  const out = dictationFailure({ name: "NotAllowedError" }, T);
  assert.equal(out.message, T.micDenied);
  assert.equal(out.retryable, false, "retrying a decision the user made is not an offer");
});

test("an absent microphone is stated the same way", () => {
  for (const name of ["NotFoundError", "NotReadableError"]) {
    assert.equal(dictationFailure({ name }, T).message, T.micUnavailable);
  }
});

test("a feature that is off in this deployment is not retryable either", () => {
  assert.deepEqual(dictationFailure({ status: 503 }, T), {
    message: T.dictationUnavailable,
    retryable: false,
  });
  assert.deepEqual(dictationFailure({ status: 413 }, T), {
    message: T.dictationTooLong,
    retryable: false,
  });
});

test("anything else may be tried again", () => {
  for (const failure of [{ status: 502 }, { name: "TypeError" }, {}]) {
    const out = dictationFailure(failure, T);
    assert.equal(out.message, T.dictationFailed);
    assert.equal(out.retryable, true);
  }
});

test("no failure message mentions a service or a status code", () => {
  for (const failure of [{ status: 502 }, { status: 503 }, { name: "NotAllowedError" }]) {
    const { message } = dictationFailure(failure, T);
    assert.ok(!/50\d|provider|openai|whisper/i.test(message));
  }
});

/* ------------------------------------ Test 3: when dictation is offered */

test("dictation is offered exactly where writing is", () => {
  assert.equal(canDictate({ isActiveRelationship: true, supported: true }), true);
  // An ended relationship accepts no messages, so a composer that could be
  // filled by voice would be a write path with a longer name.
  assert.equal(canDictate({ isActiveRelationship: false, supported: true }), false);
  assert.equal(canDictate({ isActiveRelationship: true, supported: false }), false);
});

test("the microphone counts as live from the moment permission is asked", () => {
  assert.equal(isCapturing(DICTATION_STATES.REQUESTING), true);
  assert.equal(isCapturing(DICTATION_STATES.RECORDING), true);
  assert.equal(isCapturing(DICTATION_STATES.PROCESSING), false);
  assert.equal(isCapturing(DICTATION_STATES.IDLE), false);
  assert.equal(isCapturing(DICTATION_STATES.ERROR), false);
});

/* ------------------------------------ Test 4: what may be read aloud */

const withRendering = (message, mode, text, extra = {}) => ({
  [translationKey(message, "fr", undefined, mode)]: { status: "done", text, ...extra },
});

test("the original is read from the message on screen", () => {
  const m = msg("m1");
  const out = speechSourceFor(m, SPEECH_SOURCES.ORIGINAL, {}, "fr");
  assert.equal(out.text, "body of m1");
});

test("a rendering is read only once it exists", () => {
  const m = msg("m1");
  assert.equal(speechSourceFor(m, SPEECH_SOURCES.TRANSLATION, {}, "fr"), null);

  const store = withRendering(m, RENDERING_MODES.NORMAL, "traduction");
  assert.deepEqual(speechSourceFor(m, SPEECH_SOURCES.TRANSLATION, store, "fr"), {
    text: "traduction",
    lang: "fr",
  });
});

test("a rendering still loading is not read", () => {
  const m = msg("m1");
  const store = { [translationKey(m, "fr", undefined, RENDERING_MODES.NORMAL)]: { status: "loading" } };
  assert.equal(speechSourceFor(m, SPEECH_SOURCES.TRANSLATION, store, "fr"), null);
});

test("a withdrawn message has nothing to read, in any source", () => {
  const m = msg("m1");
  const store = {
    ...withRendering(m, RENDERING_MODES.NORMAL, "traduction"),
    ...withRendering(m, RENDERING_MODES.SIMPLE, "plus simple"),
  };
  const withdrawn = { ...m, withdrawnAt: "2026-08-22T12:00:00.000Z" };

  for (const source of Object.values(SPEECH_SOURCES)) {
    assert.equal(
      speechSourceFor(withdrawn, source, store, "fr"),
      null,
      `${source} must not be readable after a withdrawal`,
    );
  }
  assert.deepEqual(availableSpeechSources(withdrawn, store, "fr"), []);
});

test("after an edit the old rendering is not read aloud", () => {
  const before = msg("m1");
  const store = withRendering(before, RENDERING_MODES.SIMPLE, "alte einfache Fassung");
  const after = msg("m1", { body: "neu", editedAt: "2026-08-22T11:00:00.000Z" });

  assert.equal(
    speechSourceFor(after, SPEECH_SOURCES.SIMPLE, store, "fr"),
    null,
    "a rendering of text nobody can see must not be spoken",
  );
  // The original, however, is read as it now stands.
  assert.equal(speechSourceFor(after, SPEECH_SOURCES.ORIGINAL, store, "fr").text, "neu");
});

test("the language told to the engine is the one the text is in", () => {
  const m = msg("m1");
  const store = withRendering(m, RENDERING_MODES.NORMAL, "traduction", { sourceLanguage: "de" });

  assert.equal(speechSourceFor(m, SPEECH_SOURCES.TRANSLATION, store, "fr").lang, "fr");
  // The original's language is whatever a rendering reported; unreported means
  // the browser decides rather than being told something unverified.
  assert.equal(speechSourceFor(m, SPEECH_SOURCES.ORIGINAL, store, "fr").lang, "de");
  assert.equal(speechSourceFor(m, SPEECH_SOURCES.ORIGINAL, {}, "fr").lang, null);
});

test("only the renderings that exist are offered", () => {
  const m = msg("m1");
  assert.deepEqual(availableSpeechSources(m, {}, "fr"), [SPEECH_SOURCES.ORIGINAL]);

  const store = {
    ...withRendering(m, RENDERING_MODES.NORMAL, "traduction"),
    ...withRendering(m, RENDERING_MODES.SIMPLE, "plus simple"),
  };
  assert.deepEqual(availableSpeechSources(m, store, "fr"), [
    SPEECH_SOURCES.ORIGINAL,
    SPEECH_SOURCES.TRANSLATION,
    SPEECH_SOURCES.SIMPLE,
  ]);
});

test("an empty message offers nothing to read", () => {
  assert.deepEqual(availableSpeechSources(msg("m1", { body: "   " }), {}, "fr"), []);
});

/* ------------------------------------ Test 5: one voice at a time */

test("only the message actually being read reports itself as speaking", () => {
  const speaking = { messageId: "m1", source: SPEECH_SOURCES.ORIGINAL };
  assert.equal(isSpeaking(speaking, "m1"), true);
  assert.equal(isSpeaking(speaking, "m2"), false);
  assert.equal(isSpeaking(speaking, "m1", SPEECH_SOURCES.ORIGINAL), true);
  assert.equal(isSpeaking(speaking, "m1", SPEECH_SOURCES.SIMPLE), false);
});

test("nothing reports itself as speaking when nothing is", () => {
  assert.equal(isSpeaking({ messageId: null, source: null }, "m1"), false);
  assert.equal(isSpeaking(null, "m1"), false);
});
