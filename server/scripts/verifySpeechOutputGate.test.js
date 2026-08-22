/**
 * Closing the two external speech-egress findings.
 *
 * `POST /api/tts` and `POST /api/previsit/audio/speak` both reached an external
 * provider whenever OPENAI_API_KEY happened to be set, on mounts carrying no
 * authentication at all. Either one was, in effect, a free text-to-speech API
 * billed to this deployment — the same inference every other gate here exists
 * to prevent, with an open door in front of it.
 *
 * These tests hold the closure, and the last group holds the repo-wide claim:
 * no speech path may become active on a general key alone.
 *
 * Run: node --test scripts/verifySpeechOutputGate.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { speakSymptomText } from "../services/symptomVoiceOutput/symptomVoiceOutputService.js";
import {
  MAX_SYMPTOM_SPEECH_CHARS,
  assertUsableSymptomSpeechRequest,
} from "../services/symptomVoiceOutput/symptomVoiceOutputPolicy.js";
import {
  APPROVED_SYMPTOM_SPEECH_HOSTS,
  resolveSymptomSpeechConfig,
} from "../services/symptomVoiceOutput/provider/symptomVoiceOutputProviderConfig.js";
import { FAKE_SYMPTOM_SPEECH_BEHAVIOURS } from "../services/symptomVoiceOutput/provider/fakeSymptomSpeechProvider.js";

import { speakPreVisitText } from "../services/preVisitVoiceOutput/preVisitVoiceOutputService.js";
import { MAX_PREVISIT_SPEECH_CHARS } from "../services/preVisitVoiceOutput/preVisitVoiceOutputPolicy.js";
import {
  APPROVED_PREVISIT_SPEECH_HOSTS,
  resolvePreVisitSpeechConfig,
} from "../services/preVisitVoiceOutput/provider/preVisitVoiceOutputProviderConfig.js";
import { FAKE_PREVISIT_SPEECH_BEHAVIOURS } from "../services/preVisitVoiceOutput/provider/fakePreVisitSpeechProvider.js";

import { SPEECH_OUTPUT_MIME, looksLikeSpeechAudio } from "../services/speechOutput/speechAudioFormat.js";
import { resolvePreVisitVoiceConfig } from "../services/preVisitVoice/provider/preVisitVoiceProviderConfig.js";
import { resolveSymptomVoiceConfig } from "../services/symptomVoice/provider/symptomVoiceProviderConfig.js";
import { resolveSttProviderConfig } from "../services/messageSpeech/provider/messageSttProviderConfig.js";

/** Source with its comments removed — these files EXPLAIN what they no longer do. */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ENV_BEFORE = {
  symptomFlag: process.env.ENABLE_SYMPTOM_VOICE_OUTPUT,
  symptomProvider: process.env.SYMPTOM_SPEECH_PROVIDER,
  previsitFlag: process.env.ENABLE_PREVISIT_VOICE_OUTPUT,
  previsitProvider: process.env.PREVISIT_SPEECH_PROVIDER,
};
process.env.ENABLE_SYMPTOM_VOICE_OUTPUT = "true";
process.env.SYMPTOM_SPEECH_PROVIDER = "fake";
process.env.ENABLE_PREVISIT_VOICE_OUTPUT = "true";
process.env.PREVISIT_SPEECH_PROVIDER = "fake";
process.on("exit", () => {
  process.env.ENABLE_SYMPTOM_VOICE_OUTPUT = ENV_BEFORE.symptomFlag ?? "";
  process.env.SYMPTOM_SPEECH_PROVIDER = ENV_BEFORE.symptomProvider ?? "";
  process.env.ENABLE_PREVISIT_VOICE_OUTPUT = ENV_BEFORE.previsitFlag ?? "";
  process.env.PREVISIT_SPEECH_PROVIDER = ENV_BEFORE.previsitProvider ?? "";
});

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

const TEXT = "Seit wann haben Sie die Beschwerden?";

/** The authorized symptom case: a signed-in patient. */
const saySymptom = (extra = {}) =>
  speakSymptomText({ userId: "some-authenticated-user", body: { text: TEXT }, ...extra });

/** The authorized Pre-Visit case: a signed-in patient. */
const sayPreVisit = (extra = {}) =>
  speakPreVisitText({ userId: "some-authenticated-user", body: { text: TEXT }, ...extra });

/* ============================= The finding this phase closes */

test("a shared API key alone activates neither speech path", () => {
  const sharedOnly = { OPENAI_API_KEY: "sk-live-shared" };
  assert.equal(resolveSymptomSpeechConfig(sharedOnly).configured, false);
  assert.equal(resolvePreVisitSpeechConfig(sharedOnly).configured, false);
});

test("a shared key cannot stand in for a missing dedicated key", () => {
  // The load-bearing isolation test. Asserting that OPENAI_API_KEY alone
  // configures nothing is not enough: with nothing else set, resolution stops
  // at the missing PROVIDER long before any key is read, so a silent
  // `?? OPENAI_API_KEY` fallback would sit there undetected. This configures
  // everything EXCEPT the dedicated credential and then offers the shared one.
  const cases = [
    [resolveSymptomSpeechConfig, "SYMPTOM_SPEECH", "SYMPTOM_SPEECH_API_KEY"],
    [resolvePreVisitSpeechConfig, "PREVISIT_SPEECH", "PREVISIT_SPEECH_API_KEY"],
  ];
  for (const [resolve, prefix, keyVar] of cases) {
    const config = resolve({
      OPENAI_API_KEY: "sk-live-shared",
      [`${prefix}_PROVIDER`]: "openai",
      [`${prefix}_BASE_URL`]: "https://localhost/v1",
      [`${prefix}_MODEL`]: "m",
      [`${prefix}_VOICE`]: "v",
    });
    assert.equal(config.configured, false, `${prefix} must not run on the shared key`);
    assert.ok(config.missing.includes(keyVar));
  }

  // The same must hold for the recognition gates closed in the two phases
  // before this one — the guarantee is repo-wide or it is nothing.
  assert.equal(
    resolveSymptomVoiceConfig({
      OPENAI_API_KEY: "sk-live-shared",
      SYMPTOM_VOICE_PROVIDER: "openai",
      SYMPTOM_VOICE_BASE_URL: "https://localhost/v1",
      SYMPTOM_VOICE_MODEL: "m",
    }).configured,
    false,
  );
  assert.equal(
    resolvePreVisitVoiceConfig({
      OPENAI_API_KEY: "sk-live-shared",
      PREVISIT_VOICE_PROVIDER: "openai",
      PREVISIT_VOICE_BASE_URL: "https://localhost/v1",
      PREVISIT_VOICE_MODEL: "m",
    }).configured,
    false,
  );
});

test("opening one audio feature opens exactly that one", () => {
  // Symptom read-aloud fully configured...
  const symptomOpen = {
    SYMPTOM_SPEECH_PROVIDER: "openai",
    SYMPTOM_SPEECH_API_KEY: "k",
    SYMPTOM_SPEECH_BASE_URL: "https://localhost/v1",
    SYMPTOM_SPEECH_MODEL: "m",
    SYMPTOM_SPEECH_VOICE: "v",
  };
  assert.equal(resolveSymptomSpeechConfig(symptomOpen).configured, true);
  // ...leaves every other audio gate shut, including its own input sibling.
  assert.equal(resolvePreVisitSpeechConfig(symptomOpen).configured, false);
  assert.equal(resolveSymptomVoiceConfig(symptomOpen).configured, false);
  assert.equal(resolvePreVisitVoiceConfig(symptomOpen).configured, false);
  assert.equal(resolveSttProviderConfig(symptomOpen).configured, false);
});

test("an input approval is not an output approval", () => {
  // The recognition credentials for the very same product areas...
  const inputsOnly = {
    SYMPTOM_VOICE_PROVIDER: "openai",
    SYMPTOM_VOICE_API_KEY: "k",
    SYMPTOM_VOICE_BASE_URL: "https://localhost/v1",
    SYMPTOM_VOICE_MODEL: "m",
    PREVISIT_VOICE_PROVIDER: "openai",
    PREVISIT_VOICE_API_KEY: "k",
    PREVISIT_VOICE_BASE_URL: "https://localhost/v1",
    PREVISIT_VOICE_MODEL: "m",
  };
  assert.equal(resolveSymptomVoiceConfig(inputsOnly).configured, true);
  assert.equal(resolvePreVisitVoiceConfig(inputsOnly).configured, true);
  // ...activate neither synthesis path.
  assert.equal(resolveSymptomSpeechConfig(inputsOnly).configured, false);
  assert.equal(resolvePreVisitSpeechConfig(inputsOnly).configured, false);
});

test("only the matching credentials, flag and host make a path active", () => {
  const own = {
    PREVISIT_SPEECH_PROVIDER: "openai",
    PREVISIT_SPEECH_API_KEY: "k",
    PREVISIT_SPEECH_BASE_URL: "https://localhost/v1",
    PREVISIT_SPEECH_MODEL: "m",
    PREVISIT_SPEECH_VOICE: "v",
  };
  assert.equal(resolvePreVisitSpeechConfig(own).configured, true);
  assert.equal(resolveSymptomSpeechConfig(own).configured, false);
});

/* ============================= The gate acts before anything is prepared */

test("with symptom read-aloud off, no provider is reached", async () => {
  process.env.ENABLE_SYMPTOM_VOICE_OUTPUT = "false";
  const seen = [];
  try {
    await assert.rejects(
      saySymptom({ providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } }),
      /symptom_speech_disabled/,
    );
  } finally {
    process.env.ENABLE_SYMPTOM_VOICE_OUTPUT = "true";
  }
  assert.deepEqual(seen, []);
});

test("with Pre-Visit read-aloud off, no provider is reached", async () => {
  process.env.ENABLE_PREVISIT_VOICE_OUTPUT = "false";
  const seen = [];
  try {
    await assert.rejects(
      sayPreVisit({ providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } }),
      /previsit_speech_disabled/,
    );
  } finally {
    process.env.ENABLE_PREVISIT_VOICE_OUTPUT = "true";
  }
  assert.deepEqual(seen, []);
});

test("with the feature on but no provider configured, nothing is transmitted", async () => {
  const before = {
    s: process.env.SYMPTOM_SPEECH_PROVIDER,
    p: process.env.PREVISIT_SPEECH_PROVIDER,
  };
  process.env.SYMPTOM_SPEECH_PROVIDER = "";
  process.env.PREVISIT_SPEECH_PROVIDER = "";
  try {
    await assert.rejects(saySymptom(), /symptom_speech_provider_not_configured/);
    await assert.rejects(sayPreVisit(), /previsit_speech_provider_not_configured/);
  } finally {
    process.env.SYMPTOM_SPEECH_PROVIDER = before.s;
    process.env.PREVISIT_SPEECH_PROVIDER = before.p;
  }
});

test("production accepts no endpoint, because none has been approved", () => {
  assert.deepEqual([...APPROVED_SYMPTOM_SPEECH_HOSTS], []);
  assert.deepEqual([...APPROVED_PREVISIT_SPEECH_HOSTS], []);
  for (const [resolve, prefix] of [
    [resolveSymptomSpeechConfig, "SYMPTOM_SPEECH"],
    [resolvePreVisitSpeechConfig, "PREVISIT_SPEECH"],
  ]) {
    const config = resolve({
      NODE_ENV: "production",
      [`${prefix}_PROVIDER`]: "openai",
      [`${prefix}_API_KEY`]: "k",
      [`${prefix}_BASE_URL`]: "https://api.example.com/v1",
      [`${prefix}_MODEL`]: "m",
      [`${prefix}_VOICE`]: "v",
      [`${prefix}_DATA_REGION`]: "eu",
      [`${prefix}_ZERO_RETENTION`]: "true",
    });
    assert.equal(config.configured, false);
    assert.equal(config.reason, "base_url_not_approved");
  }
});

test("the double can never be reached in production", () => {
  for (const [resolve, prefix] of [
    [resolveSymptomSpeechConfig, "SYMPTOM_SPEECH"],
    [resolvePreVisitSpeechConfig, "PREVISIT_SPEECH"],
  ]) {
    const config = resolve({ NODE_ENV: "production", [`${prefix}_PROVIDER`]: "fake" });
    assert.equal(config.configured, false);
    assert.equal(config.reason, "fake_provider_in_production");
  }
});

/* ============================= Authorization, which did not exist */

test("an anonymous symptom caller is refused before the provider", async () => {
  const seen = [];
  await assert.rejects(
    speakSymptomText({
      userId: null,
      body: { text: TEXT },
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /not_authorized/,
  );
  assert.deepEqual(seen, []);
});

test("an anonymous Pre-Visit caller with no context is refused before the provider", { skip }, async () => {
  const seen = [];
  await assert.rejects(
    speakPreVisitText({
      userId: null,
      body: { text: TEXT },
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /not_authorized/,
  );
  assert.deepEqual(seen, []);
});

test("an invented Pre-Visit token is worth exactly nothing", { skip }, async () => {
  const seen = [];
  await assert.rejects(
    speakPreVisitText({
      userId: null,
      body: { text: TEXT, qrToken: "definitely-not-a-real-token" },
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /not_authorized/,
  );
  assert.deepEqual(seen, []);
});

test("authorization is decided before the payload is examined", { skip }, async () => {
  // A body that would be refused on its own merits, from a caller who is not
  // allowed to be here: the refusal must be about the caller, so a malformed
  // request cannot be used to probe the validator from outside.
  await assert.rejects(
    speakPreVisitText({ userId: null, body: { text: "", nonsense: true } }),
    /not_authorized/,
  );
});

test("a real, active QR target authorizes a guest to be read to", { skip }, async (t) => {
  const suffix = `speechout-${Date.now()}@test.invalid`;
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
      practiceName: "PraxisSpeechOutput",
      publicSlug: `so-${Date.now()}`,
      isActive: true,
    },
  });
  const target = await prisma.practiceQrTarget.create({
    data: {
      practiceProfileId: practice.id,
      targetName: "Sprechstunde",
      qrToken: `qrso-${Date.now()}`,
      isActive: true,
    },
  });
  t.after(() => prisma.user.deleteMany({ where: { email: suffix } }));

  const out = await speakPreVisitText({
    userId: null,
    body: { text: TEXT, qrToken: target.qrToken },
  });
  assert.ok(looksLikeSpeechAudio(out.audio));

  // A deactivated target stops working immediately — which is what makes this
  // authorization rather than a formality.
  await prisma.practiceQrTarget.update({ where: { id: target.id }, data: { isActive: false } });
  const seen = [];
  await assert.rejects(
    speakPreVisitText({
      userId: null,
      body: { text: TEXT, qrToken: target.qrToken },
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /not_authorized/,
  );
  assert.deepEqual(seen, []);

  // So does deactivating the practice, with the target itself untouched.
  await prisma.practiceQrTarget.update({ where: { id: target.id }, data: { isActive: true } });
  await prisma.practiceProfile.update({ where: { id: practice.id }, data: { isActive: false } });
  await assert.rejects(
    speakPreVisitText({ userId: null, body: { text: TEXT, qrToken: target.qrToken } }),
    /not_authorized/,
  );
});

/* ============================= What may be asked for */

test("oversized text is refused before anything is transmitted", async () => {
  const seen = [];
  const long = "a".repeat(MAX_SYMPTOM_SPEECH_CHARS + 1);
  await assert.rejects(
    saySymptom({ body: { text: long }, providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } }),
    /text_too_long/,
  );
  assert.deepEqual(seen, []);

  const longer = "a".repeat(MAX_PREVISIT_SPEECH_CHARS + 1);
  await assert.rejects(
    sayPreVisit({ body: { text: longer }, providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } }),
    /text_too_long/,
  );
  assert.deepEqual(seen, []);
});

test("whitespace padding is not a way past the ceiling", () => {
  assert.throws(
    () => assertUsableSymptomSpeechRequest({ text: `${" ".repeat(2000)}kurz` }),
    /text_too_long/,
  );
});

test("empty text is refused", async () => {
  await assert.rejects(saySymptom({ body: { text: "   " } }), /text_required/);
  await assert.rejects(sayPreVisit({ body: { text: "" } }), /text_required/);
});

test("a caller may not name a voice, or anything else we did not review", async () => {
  const seen = [];
  await assert.rejects(
    saySymptom({
      body: { text: TEXT, voice: "shimmer" },
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /unexpected_field/,
  );
  await assert.rejects(
    sayPreVisit({ body: { text: TEXT, model: "tts-1-hd", speed: 4 } }),
    /unexpected_field/,
  );
  assert.deepEqual(seen, []);
});

test("the language hint is accepted, checked, and then not transmitted", async () => {
  const seen = [];
  const out = await sayPreVisit({
    body: { text: TEXT, language: "tr" },
    providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
  });
  assert.ok(looksLikeSpeechAudio(out.audio));
  // onCall receives the request as sent, so this is the payload itself.
  assert.deepEqual(Object.keys(seen[0]).sort(), ["text"], "only the text may reach a provider");
});

/* ============================= What leaves the process */

test("the provider is handed the text and nothing else", async () => {
  const seen = [];
  await saySymptom({ providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } });
  assert.deepEqual(Object.keys(seen[0]).sort(), ["text"]);
  assert.equal(seen[0].text, TEXT);
});

test("no identifier accompanies a Pre-Visit request, not even the token that authorized it", { skip }, async (t) => {
  const suffix = `speechmin-${Date.now()}@test.invalid`;
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
      practiceName: "PraxisSpeechMin",
      publicSlug: `sm-${Date.now()}`,
      isActive: true,
    },
  });
  const target = await prisma.practiceQrTarget.create({
    data: {
      practiceProfileId: practice.id,
      targetName: "Sprechstunde",
      qrToken: `qrsm-${Date.now()}`,
      isActive: true,
    },
  });
  t.after(() => prisma.user.deleteMany({ where: { email: suffix } }));

  const seen = [];
  await speakPreVisitText({
    userId: null,
    body: { text: TEXT, qrToken: target.qrToken, language: "de" },
    providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
  });
  assert.deepEqual(Object.keys(seen[0]).sort(), ["text"]);
  assert.ok(!JSON.stringify(seen[0]).includes(target.qrToken));
  assert.ok(!JSON.stringify(seen[0]).includes(practice.id));
});

/* ============================= What comes back */

test("a successful call returns audio, labelled by us", async () => {
  const out = await saySymptom();
  assert.equal(out.contentType, SPEECH_OUTPUT_MIME);
  assert.ok(Buffer.isBuffer(out.audio));
  assert.ok(looksLikeSpeechAudio(out.audio));
});

test("a provider failure becomes our own neutral error", async () => {
  for (const [say, behaviourKey, pattern] of [
    [saySymptom, "SERVER_ERROR", /symptom_speech_failed/],
    [saySymptom, "TIMEOUT", /symptom_speech_failed/],
  ]) {
    await assert.rejects(
      say({
        providerOptions: { fakeOptions: { behaviour: FAKE_SYMPTOM_SPEECH_BEHAVIOURS[behaviourKey] } },
      }),
      pattern,
    );
  }
  await assert.rejects(
    sayPreVisit({
      providerOptions: {
        fakeOptions: { behaviour: FAKE_PREVISIT_SPEECH_BEHAVIOURS.SERVER_ERROR },
      },
    }),
    /previsit_speech_failed/,
  );
});

test("something that is not audio is not passed on as audio", async () => {
  for (const behaviour of [
    FAKE_SYMPTOM_SPEECH_BEHAVIOURS.EMPTY,
    FAKE_SYMPTOM_SPEECH_BEHAVIOURS.NOT_AUDIO,
  ]) {
    await assert.rejects(
      saySymptom({ providerOptions: { fakeOptions: { behaviour } } }),
      /symptom_speech_failed/,
    );
  }
});

test("the format check recognises real containers and rejects error pages", () => {
  assert.equal(looksLikeSpeechAudio(Buffer.alloc(0)), false);
  assert.equal(looksLikeSpeechAudio(Buffer.from("<html>nope</html>".repeat(40))), false);
  const id3 = Buffer.alloc(512, 0);
  id3.write("ID3", 0, "ascii");
  assert.equal(looksLikeSpeechAudio(id3), true);
  const frame = Buffer.alloc(512, 0);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  assert.equal(looksLikeSpeechAudio(frame), true);
});

/* ============================= Logging */

test("the routes log a code, never what was to be spoken", async () => {
  for (const [file, label] of [
    ["../routes/tts.js", "[symptom/speech]"],
    ["../routes/previsit.js", "[previsit/audio/speak]"],
  ]) {
    const src = await readFile(new URL(file, import.meta.url), "utf8");
    const calls = [...code(src).matchAll(/console\.(error|warn|log|info)\(([^;]*)\);/g)];
    const relevant = calls.filter((m) => m[2].includes(label));
    assert.ok(relevant.length > 0, `${file} should log the ${label} failure`);
    for (const match of relevant) {
      // Only the arguments AFTER the label are inspected: the label itself
      // contains the word "speak", which would otherwise match forever.
      const args = match[2].slice(match[2].indexOf(label) + label.length + 1);
      for (const forbidden of ["text", "input", "body", "audio", "apiKey", "API_KEY", "qrToken"]) {
        assert.ok(
          !args.includes(forbidden),
          `${file} must not log ${forbidden} (found in: ${args.trim()})`,
        );
      }
    }
  }
});

test("an error carries no provider text and no spoken content", async () => {
  try {
    await saySymptom({
      body: { text: "Ihr Blutdruck war zuletzt auffällig hoch." },
      providerOptions: { fakeOptions: { behaviour: FAKE_SYMPTOM_SPEECH_BEHAVIOURS.SERVER_ERROR } },
    });
    assert.fail("should have thrown");
  } catch (err) {
    const dumped = JSON.stringify({ message: err.message, details: err.details });
    assert.ok(!dumped.includes("Blutdruck"));
    assert.ok(!/sk-/.test(dumped));
  }
});

/* ============================= Repo-wide: the Definition of Done */

test("neither speech route nor its service reads the shared key", async () => {
  for (const file of [
    "../routes/tts.js",
    "../routes/previsit.js",
    "../services/symptomVoiceOutput/symptomVoiceOutputService.js",
    "../services/symptomVoiceOutput/provider/openAiSymptomSpeechProvider.js",
    "../services/preVisitVoiceOutput/preVisitVoiceOutputService.js",
    "../services/preVisitVoiceOutput/provider/openAiPreVisitSpeechProvider.js",
  ]) {
    const src = code(await readFile(new URL(file, import.meta.url), "utf8"));
    assert.ok(!/OPENAI_API_KEY/.test(src), `${file} must not read the shared key`);
    assert.ok(
      !/preVisitAudioService|synthesizePreVisitSpeech|parseSpeakRequest/.test(src),
      `${file} must not use the ungated speech service`,
    );
    assert.ok(
      !/from ["'][^"']*openaiClient/.test(src),
      `${file} must not import the shared provider client`,
    );
  }
});

test("/api/tts is mounted behind authentication and a limiter", async () => {
  const app = code(await readFile(new URL("../app.js", import.meta.url), "utf8"));
  const mount = app.split("\n").find((line) => line.includes('"/api/tts"'));
  assert.ok(mount, "the mount should still exist");
  assert.ok(mount.includes("requireAuth"), "the mount must require a session");
  assert.ok(mount.includes("symptomSpeechLimiter"), "the mount must be rate limited");
});

test("the Pre-Visit speak route reads a session when there is one", async () => {
  const src = code(await readFile(new URL("../routes/previsit.js", import.meta.url), "utf8"));
  const route = src.slice(src.indexOf("'/audio/speak'"), src.indexOf("'/audio/speak'") + 1200);
  // Without this the guest boundary would refuse signed-in patients: the mount
  // carries no requireAuth, so nothing else populates req.user.
  assert.ok(route.includes("optionalAuth"), "a bearer token must still be read");
  assert.ok(route.includes("previsitAudioSpeakLimiter"));
});

test("no audio route can become active on a general key alone", async () => {
  // Scoped to audio deliberately. Plenty of text routes still read the shared
  // key; that is a real and separate finding, reported rather than silently
  // widened into this phase. What must hold here is narrower and absolute: no
  // path that sends audio out, or brings audio back, may be switched on by a
  // general key.
  const audioish = /audio\/(transcriptions|speech)|whisper|\btts\b|text[-_]?to[-_]?speech|transcribe/i;
  const dir = new URL("../routes/", import.meta.url);
  const offenders = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".js")) continue;
    const src = code(await readFile(new URL(name, dir), "utf8"));
    if (/OPENAI_API_KEY/.test(src) && audioish.test(src)) offenders.push(name);
  }
  assert.deepEqual(
    offenders,
    [],
    `these route files still reach a speech provider on the shared key: ${offenders.join(", ")}`,
  );
});

test("every audio feature flag is named for a feature, not a technique", async () => {
  const src = await readFile(new URL("../config/featureFlags.js", import.meta.url), "utf8");
  for (const banned of [
    "ENABLE_TTS",
    "ENABLE_TEXT_TO_SPEECH",
    "ENABLE_SPEECH",
    "ENABLE_TRANSCRIPTION",
    "ENABLE_STT",
    "ENABLE_AUDIO",
  ]) {
    assert.ok(
      !new RegExp(`["']${banned}["']`).test(src),
      `${banned} would open unrelated data flows with one switch`,
    );
  }
  // The seven that exist are each named for what they let a person do.
  for (const expected of [
    "ENABLE_MESSAGE_STT",
    "ENABLE_SYMPTOM_VOICE_INPUT",
    "ENABLE_PREVISIT_VOICE_INPUT",
    "ENABLE_SYMPTOM_VOICE_OUTPUT",
    "ENABLE_PREVISIT_VOICE_OUTPUT",
  ]) {
    assert.ok(src.includes(expected), `${expected} should exist`);
  }
});
