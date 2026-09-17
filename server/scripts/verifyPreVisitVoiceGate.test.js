/**
 * Closing the Pre-Visit transcription finding.
 *
 * `POST /api/previsit/audio/transcribe` reached an external provider whenever
 * OPENAI_API_KEY happened to be set — on a mount carrying no `requireAuth`, so
 * anyone able to reach the server could send audio onwards at the deployment's
 * expense. That is the same inference every other gate here exists to prevent,
 * with an open door in front of it.
 *
 * These tests hold the closure, and the last one holds the repo-wide claim: no
 * route may become active on a general key alone.
 *
 * Run: node --test scripts/verifyPreVisitVoiceGate.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  transcribePreVisitVoice,
  validatePreVisitTranscript,
} from "../services/preVisitVoice/preVisitVoiceService.js";
import {
  MAX_PREVISIT_VOICE_BYTES,
  MAX_PREVISIT_VOICE_SECONDS,
  PREVISIT_VOICE_MIME,
  assertUsablePreVisitVoice,
  normalizeDictationLanguage,
} from "../services/preVisitVoice/preVisitVoicePolicy.js";
import { assertPreVisitVoiceAllowed } from "../services/preVisitVoice/preVisitVoiceAuthorization.js";
import {
  APPROVED_PREVISIT_VOICE_HOSTS,
  resolvePreVisitVoiceConfig,
} from "../services/preVisitVoice/provider/preVisitVoiceProviderConfig.js";
import {
  FAKE_PREVISIT_TRANSCRIPT,
  FAKE_PREVISIT_VOICE_BEHAVIOURS,
} from "../services/preVisitVoice/provider/fakePreVisitVoiceProvider.js";
import { resolveSymptomVoiceConfig } from "../services/symptomVoice/provider/symptomVoiceProviderConfig.js";
import { resolveSttProviderConfig } from "../services/messageSpeech/provider/messageSttProviderConfig.js";

/** Source with its comments removed — these files EXPLAIN what they no longer do. */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ENV_BEFORE = {
  flag: process.env.ENABLE_PREVISIT_VOICE_INPUT,
  provider: process.env.PREVISIT_VOICE_PROVIDER,
};
process.env.ENABLE_PREVISIT_VOICE_INPUT = "true";
process.env.PREVISIT_VOICE_PROVIDER = "fake";
process.on("exit", () => {
  process.env.ENABLE_PREVISIT_VOICE_INPUT = ENV_BEFORE.flag ?? "";
  process.env.PREVISIT_VOICE_PROVIDER = ENV_BEFORE.provider ?? "";
});

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const webm = (bytes = 4096) =>
  Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(bytes)]);
/** The authorized case: a logged-in user. */
const speak = (extra = {}) =>
  transcribePreVisitVoice({
    file: { buffer: webm(), mimetype: "audio/webm;codecs=opus" },
    userId: "some-authenticated-user",
    ...extra,
  });

/* ============================= The finding this phase closes */

test("a shared API key alone activates nothing", () => {
  const config = resolvePreVisitVoiceConfig({
    NODE_ENV: "test",
    OPENAI_API_KEY: "sk-a-key-for-something-else-entirely",
  });
  assert.equal(config.configured, false);
  assert.deepEqual(config.missing, ["PREVISIT_VOICE_PROVIDER"]);
});

test("the other audio features' credentials do not activate it", () => {
  // Each data category keeps its own approval. Opening dictation or symptom
  // voice must not open a pre-visit preparation.
  const config = resolvePreVisitVoiceConfig({
    NODE_ENV: "test",
    PREVISIT_VOICE_PROVIDER: "openai",
    OPENAI_API_KEY: "shared",
    MESSAGE_STT_API_KEY: "dictation",
    MESSAGE_STT_BASE_URL: "https://api.example.com/v1",
    MESSAGE_STT_MODEL: "m",
    SYMPTOM_VOICE_API_KEY: "symptoms",
    SYMPTOM_VOICE_BASE_URL: "https://api.example.com/v1",
    SYMPTOM_VOICE_MODEL: "m",
  });
  assert.equal(config.configured, false);
  assert.deepEqual(config.missing.sort(), [
    "PREVISIT_VOICE_API_KEY",
    "PREVISIT_VOICE_BASE_URL",
    "PREVISIT_VOICE_MODEL",
  ]);
});

test("opening one audio feature opens exactly one", () => {
  const previsitOpen = {
    NODE_ENV: "test",
    PREVISIT_VOICE_PROVIDER: "openai",
    PREVISIT_VOICE_API_KEY: "k",
    PREVISIT_VOICE_BASE_URL: "https://localhost/v1",
    PREVISIT_VOICE_MODEL: "m",
  };
  assert.equal(resolvePreVisitVoiceConfig(previsitOpen).configured, true);
  assert.equal(resolveSymptomVoiceConfig(previsitOpen).configured, false);
  assert.equal(resolveSttProviderConfig(previsitOpen).configured, false);
});

test("with the feature off, no provider is reached", async () => {
  process.env.ENABLE_PREVISIT_VOICE_INPUT = "false";
  const seen = [];
  try {
    await assert.rejects(
      speak({ providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } }),
      /previsit_voice_disabled/,
    );
  } finally {
    process.env.ENABLE_PREVISIT_VOICE_INPUT = "true";
  }
  assert.deepEqual(seen, []);
});

test("with the feature on but no provider configured, nothing is transmitted", async () => {
  const before = process.env.PREVISIT_VOICE_PROVIDER;
  process.env.PREVISIT_VOICE_PROVIDER = "";
  try {
    await assert.rejects(speak(), /previsit_voice_provider_not_configured/);
  } finally {
    process.env.PREVISIT_VOICE_PROVIDER = before;
  }
});

test("neither the route nor the service reads the shared key", async () => {
  for (const file of [
    "../routes/previsit.js",
    "../services/preVisitVoice/preVisitVoiceService.js",
    "../services/preVisitVoice/provider/openAiPreVisitVoiceProvider.js",
  ]) {
    const src = code(await readFile(new URL(file, import.meta.url), "utf8"));
    assert.ok(!/OPENAI_API_KEY/.test(src), `${file} must not read the shared key`);
    assert.ok(
      !/transcribePreVisitAudio/.test(src),
      `${file} must not use the ungated transcription service`,
    );
  }
});

test("production accepts no endpoint, because none has been approved", () => {
  assert.deepEqual([...APPROVED_PREVISIT_VOICE_HOSTS], []);
  const config = resolvePreVisitVoiceConfig({
    NODE_ENV: "production",
    PREVISIT_VOICE_PROVIDER: "openai",
    PREVISIT_VOICE_API_KEY: "k",
    PREVISIT_VOICE_BASE_URL: "https://api.example.com/v1",
    PREVISIT_VOICE_MODEL: "m",
    PREVISIT_VOICE_DATA_REGION: "eu",
    PREVISIT_VOICE_ZERO_RETENTION: "true",
  });
  assert.equal(config.configured, false);
  assert.equal(config.reason, "base_url_not_approved");
});

test("the double can never be reached in production", () => {
  const config = resolvePreVisitVoiceConfig({
    NODE_ENV: "production",
    PREVISIT_VOICE_PROVIDER: "fake",
  });
  assert.equal(config.configured, false);
  assert.equal(config.reason, "fake_provider_in_production");
});

/* ============================= Authorization, which did not exist */

test("an anonymous caller with no context is refused before the provider", { skip }, async () => {
  const seen = [];
  await assert.rejects(
    transcribePreVisitVoice({
      file: { buffer: webm(), mimetype: "audio/webm" },
      userId: null,
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /not_authorized/,
  );
  assert.deepEqual(seen, [], "an unauthorized caller must not reach a provider");
});

test("an invented QR token is refused", { skip }, async () => {
  for (const qrToken of ["", "   ", "made-up-token", "../../etc/passwd"]) {
    await assert.rejects(
      assertPreVisitVoiceAllowed({ userId: null, qrToken }),
      /not_authorized/,
    );
  }
});

test("a real, active QR target authorizes a guest", { skip }, async (t) => {
  const suffix = `previsitvoice-${Date.now()}@test.invalid`;
  const owner = await prisma.user.create({
    data: {
      email: suffix,
      passwordHash: "x",
      firstName: "o",
      lastName: "Test",
      dateOfBirth: new Date("1980-01-01"),
      verified: true,
    },
  });
  const practice = await prisma.practiceProfile.create({
    data: {
      userId: owner.id,
      practiceName: "PraxisPreVisitVoice",
      publicSlug: `pv-${Date.now()}`,
      isActive: true,
    },
  });
  const target = await prisma.practiceQrTarget.create({
    data: {
      practiceProfileId: practice.id,
      targetName: "Sprechstunde",
      qrToken: `qr-${Date.now()}`,
      isActive: true,
    },
  });
  t.after(() => prisma.user.deleteMany({ where: { email: suffix } }));

  const allowed = await assertPreVisitVoiceAllowed({ userId: null, qrToken: target.qrToken });
  assert.equal(allowed.via, "qr");
  assert.equal(allowed.practiceProfileId, practice.id);

  // ...and a guest so authorized can actually use the feature.
  const out = await speak({ userId: null, qrToken: target.qrToken });
  assert.equal(out.text, FAKE_PREVISIT_TRANSCRIPT);

  // A deactivated target stops working immediately — which is what makes this
  // authorization rather than a formality.
  await prisma.practiceQrTarget.update({
    where: { id: target.id },
    data: { isActive: false },
  });
  await assert.rejects(
    assertPreVisitVoiceAllowed({ userId: null, qrToken: target.qrToken }),
    /not_authorized/,
  );
});

test("authorization is decided before the payload is even examined", { skip }, async () => {
  // An unauthorized caller uploading something oversized and mislabelled gets
  // the authorization answer, not a payload one — the server does no work for
  // them at all.
  await assert.rejects(
    transcribePreVisitVoice({
      file: { buffer: Buffer.alloc(MAX_PREVISIT_VOICE_BYTES + 1), mimetype: "application/pdf" },
      userId: null,
    }),
    /not_authorized/,
  );
});

/* ============================= The flow still works */

test("an authorized caller gets a transcript, as before", async () => {
  const out = await speak();
  assert.equal(out.text, FAKE_PREVISIT_TRANSCRIPT);
  // The answer shape the toolbar already consumes.
  assert.ok(typeof out.text === "string");
});

test("only the recording and a language hint leave the process", async () => {
  const seen = [];
  await speak({
    language: "tr",
    providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
  });

  assert.equal(seen.length, 1);
  assert.deepEqual(Object.keys(seen[0]).sort(), ["audio", "language", "mimeType"]);
  assert.equal(seen[0].language, "tr", "Pre-Visit reaches beyond the interface languages");
  const payload = JSON.stringify({ ...seen[0], audio: "<buffer>" });
  for (const forbidden of ["user", "session", "practice", "qr", "diagnos", "medic", "prompt"]) {
    assert.ok(!payload.toLowerCase().includes(forbidden), `${forbidden} must not be sent`);
  }
});

test("the language hint is shape-checked, not restricted to the interface set", () => {
  // Deliberately unlike the messaging features: a pre-visit preparation is for
  // whichever language the patient actually speaks.
  assert.equal(normalizeDictationLanguage("tr"), "tr");
  assert.equal(normalizeDictationLanguage("pt-BR"), "pt");
  assert.equal(normalizeDictationLanguage("ar"), "ar");
  for (const bad of ["", "klingon", "12", "../x", null]) {
    assert.equal(normalizeDictationLanguage(bad), null);
  }
});

/* ============================= Upload hardening */

test("an oversized recording is refused before a provider is resolved", async () => {
  const seen = [];
  await assert.rejects(
    transcribePreVisitVoice({
      file: { buffer: webm(MAX_PREVISIT_VOICE_BYTES + 1), mimetype: "audio/webm" },
      userId: "u",
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /too_large/,
  );
  assert.deepEqual(seen, []);
});

test("a payload is judged by its bytes, not by its label", async () => {
  const notAudio = Buffer.concat([Buffer.from("%PDF-1.7 a document"), Buffer.alloc(4096)]);
  const seen = [];
  await assert.rejects(
    transcribePreVisitVoice({
      file: { buffer: notAudio, mimetype: "audio/webm" },
      userId: "u",
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /invalid_audio/,
  );
  assert.deepEqual(seen, [], "a mislabelled upload must never reach a provider");
});

test("the bounds are the Pre-Visit ones, not copied from the other features", () => {
  // A pre-visit preparation is someone recounting a history; capping it at the
  // messaging limit would cut people off mid-sentence about their own health.
  assert.equal(MAX_PREVISIT_VOICE_SECONDS, 180);
  assert.equal(MAX_PREVISIT_VOICE_BYTES, 6 * 1024 * 1024);
  assert.ok(MAX_PREVISIT_VOICE_BYTES < 10 * 1024 * 1024, "still tighter than before this phase");
  assert.deepEqual([...PREVISIT_VOICE_MIME].sort(), [
    "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm",
  ]);
});

test("an unsupported type and an empty upload are refused", () => {
  for (const mimetype of ["application/pdf", "video/mp4", "audio/x-m4a", ""]) {
    assert.throws(
      () => assertUsablePreVisitVoice({ buffer: webm(), mimetype }),
      /unsupported_type/,
    );
  }
  assert.throws(
    () => assertUsablePreVisitVoice({ buffer: Buffer.alloc(0), mimetype: "audio/webm" }),
    /no_audio/,
  );
});

/* ============================= What comes back */

test("a provider failure or a volunteered diagnosis yields no transcript", async () => {
  for (const behaviour of [
    FAKE_PREVISIT_VOICE_BEHAVIOURS.SERVER_ERROR,
    FAKE_PREVISIT_VOICE_BEHAVIOURS.EMPTY,
    FAKE_PREVISIT_VOICE_BEHAVIOURS.MALFORMED,
    FAKE_PREVISIT_VOICE_BEHAVIOURS.EXTRA_FIELD,
  ]) {
    await assert.rejects(
      speak({ providerOptions: { fakeOptions: { behaviour } } }),
      /transcription_failed/,
    );
  }
});

test("the transcript contract accepts a transcription and nothing else", () => {
  assert.equal(validatePreVisitTranscript({ text: " Rückenschmerzen " }).text, "Rückenschmerzen");
  for (const bad of [
    null, "a string", [], { text: "" },
    { text: "ok", diagnosis: "x" },
    { text: "I'm sorry, I cannot transcribe that." },
    { text: "x".repeat(20_001) },
  ]) {
    assert.throws(() => validatePreVisitTranscript(bad), /transcription_failed/);
  }
});

/* ============================= Nothing is logged */

test("neither audio nor transcript can reach a log line", async () => {
  const route = code(await readFile(new URL("../routes/previsit.js", import.meta.url), "utf8"));
  const service = await readFile(
    new URL("../services/preVisitVoice/preVisitVoiceService.js", import.meta.url),
    "utf8",
  );

  // What is checked is what the log line CARRIES, not what it is called. The
  // label is the route path and contains the word "audio" by definition; the
  // arguments after it are where a recording or a transcript could leak.
  const transcribeLogs = route
    .split("\n")
    .filter((line) => line.includes("console.") && line.includes("previsit/audio/transcribe"));
  assert.ok(transcribeLogs.length > 0, "the guard must have something to check");
  for (const line of transcribeLogs) {
    const args = line.slice(line.indexOf("transcribe]") + "transcribe]".length);
    for (const forbidden of ["text", "buffer", "audio", "transcript", "req.file", "result."]) {
      assert.ok(!args.includes(forbidden), `a log line must not carry ${forbidden}: ${line.trim()}`);
    }
  }
  assert.equal((code(service).match(/console\./g) ?? []).length, 0, "the service logs nothing");
});

/* ============================= The repo-wide claim */

test("no route can become active on a general key alone", async () => {
  // The whole point of this phase and the one before it. Every route file is
  // read; none may reach the ungated audio services or the shared key for
  // audio, and the retired modules must still have no consumer.
  const routesDir = new URL("../routes/", import.meta.url);
  const offenders = [];

  for (const entry of await readdir(routesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const src = code(await readFile(new URL(entry.name, routesDir), "utf8"));

    for (const [pattern, why] of [
      [/from ["'][^"']*whisperService/, "imports the ungated whisper service"],
      [/from ["'][^"']*uploadAudio/, "imports the ungated audio upload"],
      [/from ["'][^"']*azureSpeech/, "imports the ungated azure speech service"],
      [/transcribePreVisitAudio/, "uses the ungated Pre-Visit transcription"],
    ]) {
      if (pattern.test(src)) offenders.push(`${entry.name} ${why}`);
    }
  }

  assert.deepEqual(offenders, [], "an ungated audio path has a consumer again");
});

test("every audio feature flag is named for a feature, not a technique", async () => {
  const flags = code(
    await readFile(new URL("../config/featureFlags.js", import.meta.url), "utf8"),
  );
  for (const banned of ["ENABLE_TRANSCRIPTION", "ENABLE_SPEECH", "ENABLE_AUDIO", "ENABLE_STT"]) {
    assert.ok(!flags.includes(banned), `${banned} would collapse distinct data categories`);
  }
  for (const expected of [
    "ENABLE_MESSAGE_STT",
    "ENABLE_SYMPTOM_VOICE_INPUT",
    "ENABLE_PREVISIT_VOICE_INPUT",
  ]) {
    assert.ok(flags.includes(expected), `${expected} must exist`);
  }
});
