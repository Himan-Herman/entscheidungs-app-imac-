/**
 * Dictation (Phase 4C).
 *
 * The promise is deliberately small: a recording becomes a string in a text
 * field, and nothing else happens. No message, no row, no read state, no stored
 * audio. Most of this file exists to prove the "nothing else" half.
 *
 * The provider is the in-process double throughout. Recognition quality is not
 * what these tests are about and could not be tested repeatably anyway; what
 * they establish is what left the process, what came back, what was refused,
 * and that no message was created along the way.
 *
 * Run: node --test scripts/verifyMessageDictation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { transcribeDictation, validateTranscript } from "../services/messageSpeech/messageSttService.js";
import {
  ALLOWED_AUDIO_MIME,
  DICTATION_LANGUAGES,
  MAX_DICTATION_BYTES,
  MAX_DICTATION_SECONDS,
  MESSAGE_STT_ERRORS,
  assertContainerMatches,
  assertDictationLanguage,
  assertSupportedAudioType,
  assertUsableDictation,
} from "../services/messageSpeech/messageSttPolicy.js";
import {
  APPROVED_STT_PROVIDER_HOSTS,
  resolveSttProviderConfig,
} from "../services/messageSpeech/provider/messageSttProviderConfig.js";
import {
  FAKE_STT_BEHAVIOURS,
  FAKE_TRANSCRIPT,
} from "../services/messageSpeech/provider/fakeMessageSttProvider.js";

const ENV_BEFORE = {
  flag: process.env.ENABLE_MESSAGE_STT,
  provider: process.env.MESSAGE_STT_PROVIDER,
};
process.env.ENABLE_MESSAGE_STT = "true";
process.env.MESSAGE_STT_PROVIDER = "fake";
process.on("exit", () => {
  process.env.ENABLE_MESSAGE_STT = ENV_BEFORE.flag ?? "";
  process.env.MESSAGE_STT_PROVIDER = ENV_BEFORE.provider ?? "";
});

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/** A buffer that really is the container it claims to be. */
const webm = (bytes = 4096) =>
  Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(bytes)]);
const dictate = (extra = {}) =>
  transcribeDictation({
    file: { buffer: webm(), mimetype: "audio/webm;codecs=opus" },
    writeAuthorized: true,
    ...extra,
  });

/* ============================================ What it produces */

test("a recording becomes a draft, and only a draft", { skip: false }, async () => {
  const out = await dictate();

  assert.equal(out.draftText, FAKE_TRANSCRIPT);
  // Named a draft, and carrying nothing that resembles a message.
  assert.deepEqual(Object.keys(out).sort(), ["detectedLanguage", "draftText", "providerKind"]);
  assert.equal("id" in out, false);
  assert.equal("messageId" in out, false);
  assert.equal("createdAt" in out, false);
});

test("no message row is created by dictating", { skip }, async () => {
  const before = await prisma.practicePatientMessage.count();
  await dictate();
  assert.equal(
    await prisma.practicePatientMessage.count(),
    before,
    "dictation must never create a message",
  );
});

test("no thread, no read state and no translation entry are touched", { skip }, async () => {
  const counts = async () => ({
    messages: await prisma.practicePatientMessage.count(),
    threads: await prisma.practicePatientThread.count(),
    translations: await prisma.practiceMessageTranslation.count(),
    unread: await prisma.practicePatientMessage.count({ where: { readAt: null } }),
  });

  const before = await counts();
  await dictate();
  assert.deepEqual(await counts(), before, "nothing in the conversation may move");
});

test("the language hint is optional and never authorizes anything", { skip: false }, async () => {
  const withHint = await dictate({ language: "de" });
  const without = await dictate();
  assert.equal(withHint.draftText, without.draftText);

  for (const bad of ["ar", "zz", "klingon"]) {
    await assert.rejects(dictate({ language: bad }), /unsupported_dictation_language/);
  }
  assert.deepEqual([...DICTATION_LANGUAGES], ["de", "en", "fr", "es", "it", "ru"]);
});

/* ============================================ Authorization */

test("without established write authorization nothing is transmitted", { skip: false }, async () => {
  const seen = [];
  for (const writeAuthorized of [false, undefined, null, "yes", 1]) {
    await assert.rejects(
      transcribeDictation({
        file: { buffer: webm(), mimetype: "audio/webm" },
        writeAuthorized,
        providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
      }),
      /message_stt_provider_not_configured/,
    );
  }
  assert.deepEqual(seen, [], "the provider must never be reached");
});

/* ============================================ The payload */

test("only the recording and a language hint leave the process", { skip: false }, async () => {
  const seen = [];
  await dictate({
    language: "de",
    providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
  });

  assert.equal(seen.length, 1, "one recording, one call");
  assert.deepEqual(Object.keys(seen[0]).sort(), ["audio", "language", "mimeType", "signal"]);
  assert.equal(seen[0].language, "de");
  assert.ok(Buffer.isBuffer(seen[0].audio));

  // Nothing about the conversation or the people in it accompanies it.
  const payload = JSON.stringify({ ...seen[0], audio: "<buffer>" });
  for (const forbidden of ["thread", "patient", "practice", "message", "diagnos", "medic"]) {
    assert.ok(!payload.toLowerCase().includes(forbidden), `${forbidden} must not be sent`);
  }
});

test("no medical vocabulary is ever used to prime the recogniser", { skip: false }, async () => {
  // Priming with someone's medication list would transmit that list and push
  // recognition towards words they may not have said. There is no field for it
  // and no caller may add one.
  const seen = [];
  await dictate({ providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } });
  const keys = Object.keys(seen[0]);
  for (const banned of ["prompt", "context", "vocabulary", "hints", "terms", "history"]) {
    assert.ok(!keys.includes(banned), `${banned} must not be part of the request`);
  }
});

/* ============================================ What is refused */

test("an oversized recording is refused before any provider is resolved", { skip: false }, async () => {
  const seen = [];
  await assert.rejects(
    transcribeDictation({
      file: { buffer: webm(MAX_DICTATION_BYTES + 1), mimetype: "audio/webm" },
      writeAuthorized: true,
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /audio_too_large/,
  );
  assert.deepEqual(seen, [], "nothing oversized may be transmitted");
});

test("a mislabelled upload is refused by its bytes, not its label", { skip: false }, async () => {
  const notAudio = Buffer.concat([Buffer.from("%PDF-1.7 this is a document"), Buffer.alloc(4096)]);
  const seen = [];
  await assert.rejects(
    transcribeDictation({
      file: { buffer: notAudio, mimetype: "audio/webm" },
      writeAuthorized: true,
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /audio_malformed/,
  );
  assert.deepEqual(seen, []);
});

test("every accepted container type is recognised by its signature", { skip: false }, () => {
  const samples = {
    "audio/webm": [0x1a, 0x45, 0xdf, 0xa3],
    "audio/ogg": [0x4f, 0x67, 0x67, 0x53],
    "audio/mpeg": [0x49, 0x44, 0x33],
    "audio/wav": [0x52, 0x49, 0x46, 0x46],
  };
  for (const [mime, sig] of Object.entries(samples)) {
    const buf = Buffer.concat([Buffer.from(sig), Buffer.alloc(1024)]);
    assert.equal(assertContainerMatches(buf, mime), true, `${mime} must be recognised`);
  }
  // MP4 carries its signature after the box length.
  const mp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 0x20]),
    Buffer.from("ftypisom"),
    Buffer.alloc(1024),
  ]);
  assert.equal(assertContainerMatches(mp4, "audio/mp4"), true);
  assert.deepEqual([...ALLOWED_AUDIO_MIME].sort(), [
    "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm",
  ]);
});

test("a type nothing records is refused", { skip: false }, () => {
  for (const mime of ["application/pdf", "video/mp4", "text/plain", "", null]) {
    assert.throws(() => assertSupportedAudioType(mime), /unsupported_audio_type/);
  }
  // Codec parameters are tolerated — a browser always sends them.
  assert.equal(assertSupportedAudioType("audio/webm;codecs=opus"), "audio/webm");
});

test("an empty or near-empty recording is refused", { skip: false }, () => {
  for (const buffer of [Buffer.alloc(0), Buffer.alloc(100)]) {
    assert.throws(
      () => assertUsableDictation({ buffer, mimetype: "audio/webm" }),
      /no_audio|audio_too_short/,
    );
  }
});

/* ============================================ Provider behaviour */

test("a provider failure produces no draft and no side effect", { skip }, async () => {
  const before = await prisma.practicePatientMessage.count();

  for (const behaviour of [
    FAKE_STT_BEHAVIOURS.SERVER_ERROR,
    FAKE_STT_BEHAVIOURS.TIMEOUT,
    FAKE_STT_BEHAVIOURS.EMPTY,
    FAKE_STT_BEHAVIOURS.MALFORMED,
    FAKE_STT_BEHAVIOURS.REFUSAL,
    FAKE_STT_BEHAVIOURS.HUGE,
  ]) {
    await assert.rejects(
      dictate({ providerOptions: { fakeOptions: { behaviour } } }),
      /message_stt_provider_failed|transcript_rejected/,
      `behaviour ${behaviour} must be refused`,
    );
  }
  assert.equal(await prisma.practicePatientMessage.count(), before);
});

test("a summary or a diagnosis handed back is refused, not stripped", { skip: false }, async () => {
  // A service that volunteers more than a transcription has done something this
  // feature must not pass on. Quietly dropping the extra field would hide it.
  for (const behaviour of [
    FAKE_STT_BEHAVIOURS.SUMMARISED,
    FAKE_STT_BEHAVIOURS.EXTRA_FIELD,
  ]) {
    await assert.rejects(
      dictate({ providerOptions: { fakeOptions: { behaviour } } }),
      /transcript_rejected/,
    );
  }
});

test("the transcript contract accepts a transcription and nothing else", { skip: false }, () => {
  const ok = validateTranscript({ text: " Guten Tag ", language: "DE" }, { bytes: 100 });
  assert.equal(ok.text, "Guten Tag");
  assert.equal(ok.language, "de");

  for (const bad of [
    null,
    "a string",
    [],
    { text: "" },
    { text: "   " },
    { text: "ok", summary: "x" },
    { text: "I'm sorry, I cannot transcribe that." },
    { text: "x".repeat(10_001) },
  ]) {
    assert.throws(() => validateTranscript(bad, { bytes: 1 }), /transcript_rejected/);
  }
});

/* ============================================ The gate */

test("with the feature off nothing is transmitted", { skip: false }, async () => {
  process.env.ENABLE_MESSAGE_STT = "false";
  const seen = [];
  try {
    await assert.rejects(
      dictate({ providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } }),
      /message_stt_disabled/,
    );
  } finally {
    process.env.ENABLE_MESSAGE_STT = "true";
  }
  assert.deepEqual(seen, [], "the provider is never reached");
});

test("an unconfigured provider refuses before the audio is read", { skip: false }, async () => {
  const before = process.env.MESSAGE_STT_PROVIDER;
  process.env.MESSAGE_STT_PROVIDER = "";
  try {
    await assert.rejects(dictate(), /message_stt_provider_not_configured/);
  } finally {
    process.env.MESSAGE_STT_PROVIDER = before;
  }
});

test("the double can never be reached in production", { skip: false }, () => {
  const config = resolveSttProviderConfig({
    NODE_ENV: "production",
    MESSAGE_STT_PROVIDER: "fake",
  });
  assert.equal(config.configured, false);
  assert.equal(config.reason, "fake_provider_in_production");
});

test("production accepts no endpoint, because none has been approved", { skip: false }, () => {
  assert.deepEqual([...APPROVED_STT_PROVIDER_HOSTS], []);
  const config = resolveSttProviderConfig({
    NODE_ENV: "production",
    MESSAGE_STT_PROVIDER: "openai",
    MESSAGE_STT_API_KEY: "k",
    MESSAGE_STT_BASE_URL: "https://api.example.com/v1",
    MESSAGE_STT_MODEL: "m",
    MESSAGE_STT_DATA_REGION: "eu",
    MESSAGE_STT_ZERO_RETENTION: "true",
  });
  assert.equal(config.configured, false);
  assert.equal(config.reason, "base_url_not_approved");
});

test("no other feature's credentials configure dictation", { skip: false }, () => {
  // An approval to send text is not an approval to send a recording, and the
  // shared key is not an approval for anything here.
  const config = resolveSttProviderConfig({
    NODE_ENV: "test",
    MESSAGE_STT_PROVIDER: "openai",
    OPENAI_API_KEY: "shared",
    MESSAGE_TRANSLATION_API_KEY: "text",
    MESSAGE_TRANSLATION_BASE_URL: "https://api.example.com/v1",
    DOCUMENT_TRANSLATION_API_KEY: "documents",
  });
  assert.equal(config.configured, false);
  assert.deepEqual(config.missing.sort(), [
    "MESSAGE_STT_API_KEY",
    "MESSAGE_STT_BASE_URL",
    "MESSAGE_STT_MODEL",
  ]);
});

test("the duration limit is stated and is a dictation, not a recording session", { skip: false }, () => {
  assert.equal(MAX_DICTATION_SECONDS, 90);
  assert.ok(MAX_DICTATION_BYTES <= 4 * 1024 * 1024);
});

/* ============================================ Nothing is kept */

test("the recording is never written anywhere", { skip: false }, async () => {
  // There is no temp directory, no filename and no row to check, which is the
  // point: the audio exists as a buffer for the duration of one call. What can
  // be asserted is that the service returns nothing that references it.
  const out = await dictate();
  const serialized = JSON.stringify(out);
  assert.ok(!serialized.includes("tmp"));
  assert.ok(!serialized.includes("/"));
  assert.equal("audio" in out, false);
  assert.equal("path" in out, false);
  assert.equal("file" in out, false);
});
