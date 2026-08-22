/**
 * Closing the legacy transcription path.
 *
 * `/api/transcribe` used to reach an external provider whenever OPENAI_API_KEY
 * happened to be set: no feature flag, no endpoint allowlist, no container
 * check. A key configured for an unrelated feature was, in effect, an approval
 * to transmit a patient's spoken description of their symptoms.
 *
 * These tests hold the closure: the shared key alone activates nothing, the
 * feature refuses before any audio is read, and the messaging dictation path
 * from Phase 4C is untouched by all of it.
 *
 * Run: node --test scripts/verifySymptomVoiceGate.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "dotenv/config";

import {
  transcribeSymptomVoice,
  validateSymptomTranscript,
} from "../services/symptomVoice/symptomVoiceService.js";
import {
  MAX_SYMPTOM_VOICE_BYTES,
  MAX_SYMPTOM_VOICE_SECONDS,
  SYMPTOM_VOICE_MIME,
  assertUsableSymptomVoice,
} from "../services/symptomVoice/symptomVoicePolicy.js";
import {
  APPROVED_SYMPTOM_VOICE_HOSTS,
  resolveSymptomVoiceConfig,
} from "../services/symptomVoice/provider/symptomVoiceProviderConfig.js";
import {
  FAKE_SYMPTOM_TRANSCRIPT,
  FAKE_SYMPTOM_VOICE_BEHAVIOURS,
} from "../services/symptomVoice/provider/fakeSymptomVoiceProvider.js";
import { resolveSttProviderConfig } from "../services/messageSpeech/provider/messageSttProviderConfig.js";
import { audioContainerMatches, normalizeAudioMime } from "../services/audioUpload/audioContainer.js";

/**
 * Source with its comments removed.
 *
 * These files EXPLAIN what they no longer do, so they name the shared key and
 * the flag name that was rejected. A guard matching raw text would fire on the
 * explanation and pass on the code — which is worse than no guard, because it
 * looks like one.
 */
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ENV_BEFORE = {
  flag: process.env.ENABLE_SYMPTOM_VOICE_INPUT,
  provider: process.env.SYMPTOM_VOICE_PROVIDER,
};
process.env.ENABLE_SYMPTOM_VOICE_INPUT = "true";
process.env.SYMPTOM_VOICE_PROVIDER = "fake";
process.on("exit", () => {
  process.env.ENABLE_SYMPTOM_VOICE_INPUT = ENV_BEFORE.flag ?? "";
  process.env.SYMPTOM_VOICE_PROVIDER = ENV_BEFORE.provider ?? "";
});

const webm = (bytes = 4096) =>
  Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(bytes)]);
const speak = (extra = {}) =>
  transcribeSymptomVoice({
    file: { buffer: webm(), mimetype: "audio/webm;codecs=opus" },
    ...extra,
  });

/* ================================= The finding this phase closes */

test("a shared API key alone activates nothing", () => {
  // The heart of it. Before this phase, OPENAI_API_KEY being present was the
  // whole of the approval.
  const config = resolveSymptomVoiceConfig({
    NODE_ENV: "test",
    OPENAI_API_KEY: "sk-a-key-for-something-else-entirely",
  });
  assert.equal(config.configured, false);
  assert.deepEqual(config.missing, ["SYMPTOM_VOICE_PROVIDER"]);
});

test("no other feature's credentials configure it either", () => {
  const config = resolveSymptomVoiceConfig({
    NODE_ENV: "test",
    SYMPTOM_VOICE_PROVIDER: "openai",
    OPENAI_API_KEY: "shared",
    MESSAGE_STT_API_KEY: "dictation",
    MESSAGE_STT_BASE_URL: "https://api.example.com/v1",
    MESSAGE_TRANSLATION_API_KEY: "text",
    DOCUMENT_TRANSLATION_API_KEY: "documents",
  });
  assert.equal(config.configured, false);
  assert.deepEqual(config.missing.sort(), [
    "SYMPTOM_VOICE_API_KEY",
    "SYMPTOM_VOICE_BASE_URL",
    "SYMPTOM_VOICE_MODEL",
  ]);
});

test("with the feature off, no provider is reached", async () => {
  process.env.ENABLE_SYMPTOM_VOICE_INPUT = "false";
  const seen = [];
  try {
    await assert.rejects(
      speak({ providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } }),
      /symptom_voice_disabled/,
    );
  } finally {
    process.env.ENABLE_SYMPTOM_VOICE_INPUT = "true";
  }
  assert.deepEqual(seen, [], "nothing may be transmitted while the gate is closed");
});

test("with the feature on but no provider configured, nothing is transmitted", async () => {
  const before = process.env.SYMPTOM_VOICE_PROVIDER;
  process.env.SYMPTOM_VOICE_PROVIDER = "";
  try {
    await assert.rejects(speak(), /symptom_voice_provider_not_configured/);
  } finally {
    process.env.SYMPTOM_VOICE_PROVIDER = before;
  }
});

test("the route source contains no reference to the shared key", async () => {
  // A greppable guarantee: neither the route nor the service may reach for
  // OPENAI_API_KEY, directly or through the shared client.
  for (const file of [
    "../routes/transcribe.js",
    "../services/symptomVoice/symptomVoiceService.js",
    "../services/symptomVoice/provider/openAiSymptomVoiceProvider.js",
  ]) {
    const src = code(await readFile(new URL(file, import.meta.url), "utf8"));
    assert.ok(!src.includes("OPENAI_API_KEY"), `${file} must not read the shared key`);
    assert.ok(!/from ["'].*openaiClient/.test(src), `${file} must not use the shared client`);
    assert.ok(!src.includes("whisperService"), `${file} must not use the ungated service`);
  }
});

test("production accepts no endpoint, because none has been approved", () => {
  assert.deepEqual([...APPROVED_SYMPTOM_VOICE_HOSTS], []);
  const config = resolveSymptomVoiceConfig({
    NODE_ENV: "production",
    SYMPTOM_VOICE_PROVIDER: "openai",
    SYMPTOM_VOICE_API_KEY: "k",
    SYMPTOM_VOICE_BASE_URL: "https://api.example.com/v1",
    SYMPTOM_VOICE_MODEL: "m",
    SYMPTOM_VOICE_DATA_REGION: "eu",
    SYMPTOM_VOICE_ZERO_RETENTION: "true",
  });
  assert.equal(config.configured, false);
  assert.equal(config.reason, "base_url_not_approved");
});

test("the double can never be reached in production", () => {
  const config = resolveSymptomVoiceConfig({
    NODE_ENV: "production",
    SYMPTOM_VOICE_PROVIDER: "fake",
  });
  assert.equal(config.configured, false);
  assert.equal(config.reason, "fake_provider_in_production");
});

/* ================================= The flow still works */

test("with both gates open the symptom flow transcribes as before", async () => {
  const out = await speak();
  assert.equal(out.text, FAKE_SYMPTOM_TRANSCRIPT);
  assert.equal(out.language, "de");
  // The answer shape the VoiceInput control already consumes.
  assert.deepEqual(Object.keys(out).sort(), ["language", "providerKind", "text"]);
});

test("only the recording leaves the process", async () => {
  const seen = [];
  await speak({ providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } } });

  assert.equal(seen.length, 1);
  assert.deepEqual(Object.keys(seen[0]).sort(), ["audio", "mimeType"]);
  assert.ok(Buffer.isBuffer(seen[0].audio));
  // No session, no user, no symptom context, and no medical vocabulary to
  // "help" recognition.
  const payload = JSON.stringify({ ...seen[0], audio: "<buffer>" });
  for (const forbidden of ["user", "session", "symptom", "diagnos", "medic", "prompt"]) {
    assert.ok(!payload.toLowerCase().includes(forbidden), `${forbidden} must not be sent`);
  }
});

/* ================================= Upload hardening */

test("an oversized recording is refused before a provider is resolved", async () => {
  const seen = [];
  await assert.rejects(
    transcribeSymptomVoice({
      file: { buffer: webm(MAX_SYMPTOM_VOICE_BYTES + 1), mimetype: "audio/webm" },
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /audio_too_large/,
  );
  assert.deepEqual(seen, []);
});

test("a payload is judged by its bytes, not by its label", async () => {
  const notAudio = Buffer.concat([
    Buffer.from("%PDF-1.7 this is a document, not a recording"),
    Buffer.alloc(4096),
  ]);
  const seen = [];
  await assert.rejects(
    transcribeSymptomVoice({
      file: { buffer: notAudio, mimetype: "audio/webm" },
      providerOptions: { fakeOptions: { onCall: (r) => seen.push(r) } },
    }),
    /audio_malformed/,
  );
  assert.deepEqual(seen, [], "a mislabelled upload must never reach a provider");
});

test("an unsupported type and an empty upload are refused", () => {
  for (const mimetype of ["application/pdf", "video/mp4", "text/plain", ""]) {
    assert.throws(
      () => assertUsableSymptomVoice({ buffer: webm(), mimetype }),
      /unsupported_audio_type/,
    );
  }
  assert.throws(
    () => assertUsableSymptomVoice({ buffer: Buffer.alloc(0), mimetype: "audio/webm" }),
    /no_audio/,
  );
  assert.throws(
    () => assertUsableSymptomVoice({ buffer: Buffer.alloc(64), mimetype: "audio/webm" }),
    /audio_too_short/,
  );
});

test("the bound is a dictation, not an unbounded upload", () => {
  // Before this phase: 10 MB and no duration bound at all. The client stops
  // recording at 60 seconds, so this is headroom rather than a restriction.
  assert.equal(MAX_SYMPTOM_VOICE_SECONDS, 90);
  assert.ok(MAX_SYMPTOM_VOICE_BYTES <= 2 * 1024 * 1024);
  assert.deepEqual([...SYMPTOM_VOICE_MIME].sort(), [
    "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm",
  ]);
});

/* ================================= What comes back */

test("a provider failure yields no transcript", async () => {
  for (const behaviour of [
    FAKE_SYMPTOM_VOICE_BEHAVIOURS.SERVER_ERROR,
    FAKE_SYMPTOM_VOICE_BEHAVIOURS.EMPTY,
    FAKE_SYMPTOM_VOICE_BEHAVIOURS.MALFORMED,
  ]) {
    await assert.rejects(
      speak({ providerOptions: { fakeOptions: { behaviour } } }),
      /symptom_voice_provider_failed|transcript_rejected/,
    );
  }
});

test("a volunteered diagnosis is refused, not stripped", async () => {
  // A service that returns more than a transcription has done something this
  // path must never pass into a symptom description field.
  await assert.rejects(
    speak({
      providerOptions: { fakeOptions: { behaviour: FAKE_SYMPTOM_VOICE_BEHAVIOURS.EXTRA_FIELD } },
    }),
    /transcript_rejected/,
  );
});

test("the transcript contract accepts a transcription and nothing else", () => {
  assert.equal(validateSymptomTranscript({ text: " Kopfschmerzen ", language: "DE" }).text,
    "Kopfschmerzen");
  for (const bad of [
    null, "a string", [], { text: "" },
    { text: "ok", diagnosis: "x" },
    { text: "I'm sorry, I cannot transcribe that." },
    { text: "x".repeat(10_001) },
  ]) {
    assert.throws(() => validateSymptomTranscript(bad), /transcript_rejected/);
  }
});

/* ================================= Nothing is logged */

test("neither audio nor transcript can reach a log line", async () => {
  const route = await readFile(new URL("../routes/transcribe.js", import.meta.url), "utf8");
  const service = await readFile(
    new URL("../services/symptomVoice/symptomVoiceService.js", import.meta.url),
    "utf8",
  );

  // Every console call in the route logs the error CODE and nothing else.
  const logs = route.match(/console\.(log|error|warn|info)\([^)]*\)/g) ?? [];
  assert.ok(logs.length > 0, "the guard must have something to check");
  for (const line of logs) {
    for (const forbidden of ["text", "buffer", "audio", "transcript", "req.file", "result."]) {
      assert.ok(!line.includes(forbidden), `a log line must not carry ${forbidden}: ${line}`);
    }
  }
  assert.equal((service.match(/console\./g) ?? []).length, 0, "the service logs nothing at all");
});

/* ================================= Phase 4C stays separate */

test("dictation into a message keeps its own, untouched gate", () => {
  // Opening symptom voice input must not open messaging dictation, and the two
  // read entirely different variables.
  const symptomOpen = {
    NODE_ENV: "test",
    ENABLE_SYMPTOM_VOICE_INPUT: "true",
    SYMPTOM_VOICE_PROVIDER: "openai",
    SYMPTOM_VOICE_API_KEY: "k",
    SYMPTOM_VOICE_BASE_URL: "https://localhost/v1",
    SYMPTOM_VOICE_MODEL: "m",
  };
  assert.equal(resolveSymptomVoiceConfig(symptomOpen).configured, true);
  assert.equal(
    resolveSttProviderConfig(symptomOpen).configured,
    false,
    "messaging dictation must stay closed",
  );

  // ...and the reverse.
  const messagingOpen = {
    NODE_ENV: "test",
    MESSAGE_STT_PROVIDER: "openai",
    MESSAGE_STT_API_KEY: "k",
    MESSAGE_STT_BASE_URL: "https://localhost/v1",
    MESSAGE_STT_MODEL: "m",
  };
  assert.equal(resolveSttProviderConfig(messagingOpen).configured, true);
  assert.equal(resolveSymptomVoiceConfig(messagingOpen).configured, false);
});

test("the shared container facts are shared, the decisions are not", () => {
  // One answer to "does this look like a WebM file", because that is a fact.
  assert.equal(normalizeAudioMime("audio/webm;codecs=opus"), "audio/webm");
  assert.equal(audioContainerMatches(webm(), "audio/webm"), true);
  assert.equal(audioContainerMatches(Buffer.from("not audio at all"), "audio/webm"), false);
});

test("the ungated whisper path has no consumer left", async () => {
  // `whisperService` and the generic `uploadAudio` were what /api/transcribe
  // used to run on: the shared key, ten megabytes, no flag. Nothing routes to
  // them any more, and this keeps it that way — a future route importing them
  // would reintroduce exactly the finding this phase closed.
  const { readdir } = await import("node:fs/promises");
  const dirs = ["../routes", "../services"];
  const offenders = [];

  for (const dir of dirs) {
    const base = new URL(`${dir}/`, import.meta.url);
    const walk = async (url, prefix) => {
      for (const entry of await readdir(url, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          await walk(new URL(`${entry.name}/`, url), `${prefix}${entry.name}/`);
          continue;
        }
        if (!entry.name.endsWith(".js")) continue;
        // The modules themselves are allowed to exist; what must not exist is
        // something importing them.
        if (entry.name === "whisperService.js") continue;
        const src = code(await readFile(new URL(entry.name, url), "utf8"));
        if (/from ["'][^"']*whisperService/.test(src)) {
          offenders.push(`${prefix}${entry.name} imports whisperService`);
        }
        if (/from ["'][^"']*uploadAudio/.test(src)) {
          offenders.push(`${prefix}${entry.name} imports uploadAudio`);
        }
      }
    };
    await walk(base, dir.replace("../", "") + "/");
  }

  assert.deepEqual(offenders, [], "no route may run on the ungated audio path");
});

test("no universal transcription flag was introduced", async () => {
  const raw = await readFile(new URL("../config/featureFlags.js", import.meta.url), "utf8");
  const flags = code(raw);
  for (const banned of ["ENABLE_TRANSCRIPTION", "ENABLE_SPEECH", "ENABLE_AUDIO"]) {
    assert.ok(
      !flags.includes(banned),
      `${banned} would put unrelated data categories behind one switch`,
    );
  }
  // The guard has to be able to fail: prove it looks at real flag names.
  assert.ok(flags.includes("ENABLE_MESSAGE_STT"), "the guard matches nothing — it has gone stale");
  // The four that exist are each named for a feature, not for a technique.
  for (const expected of [
    "ENABLE_DOCUMENT_TRANSLATION",
    "ENABLE_MESSAGE_TRANSLATION",
    "ENABLE_MESSAGE_STT",
    "ENABLE_SYMPTOM_VOICE_INPUT",
  ]) {
    assert.ok(flags.includes(expected), `${expected} must exist`);
  }
});
