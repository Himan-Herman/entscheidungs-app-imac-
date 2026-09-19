/**
 * Meda Live — Realtime session configuration.
 *
 * Holds three promises:
 *  1. A client that opted in gets `create_response: false` — the model does not
 *     speak before the client has checked the segment.
 *  2. Old clients (PWA cache, installed App Store / Play Store builds) keep the
 *     exact server-driven session — they never opted in and would otherwise
 *     stop translating silently.
 *  3. The language pair decides the mode; a transcription session can never
 *     answer, translate or speak.
 *
 * Pure: no network, no credential, no database.
 * Run: node --test scripts/verifyMedaRealtimeSession.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MEDA_SESSION_MODES,
  RESPONSE_GATING,
  TRANSCRIPTION_SESSION_INSTRUCTIONS,
  buildMedaRealtimeSession,
  isClientResponseGatingEnabled,
  parseMedaSessionRequest,
} from "../services/medaRealtime/medaRealtimeSessionConfig.js";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BASE = {
  instructions: "INTERPRETER-INSTRUCTIONS",
  model: "gpt-realtime",
  transcriptionModel: "gpt-4o-transcribe",
  voice: "marin",
  silenceMs: 1500,
  env: {},
};

test("request: validation is unchanged for every existing error", () => {
  assert.equal(parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "en" }).ok, true);
  assert.equal(
    parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "de" }).error,
    "interpretation_requires_two_languages",
  );
  assert.equal(parseMedaSessionRequest({ patientLanguage: "xx", practiceLanguage: "en" }).error, "unsupported_language");
  assert.equal(parseMedaSessionRequest({}).error, "invalid_input");
  assert.equal(parseMedaSessionRequest(null).error, "invalid_input");
});

test("request: two languages = interpretation, one language = transcription (any language)", () => {
  const i = parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "en" });
  assert.equal(i.mode, MEDA_SESSION_MODES.INTERPRETATION);
  for (const l of ["de", "en", "fr", "es", "it", "ru", "tr"]) {
    const t = parseMedaSessionRequest({ patientLanguage: l, practiceLanguage: l, mode: "transcription" });
    assert.equal(t.ok, true, l);
    assert.equal(t.mode, MEDA_SESSION_MODES.TRANSCRIPTION, l);
  }
});

test("request: mode mismatches are refused, never reinterpreted", () => {
  assert.equal(
    parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "de" }).error,
    "interpretation_requires_two_languages",
    "old clients (no mode) keep the old answer for the same language twice",
  );
  assert.equal(
    parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "en", mode: "transcription" }).error,
    "transcription_requires_same_language",
  );
  assert.equal(
    parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "de", mode: "interpretation" }).error,
    "interpretation_requires_two_languages",
  );
  assert.equal(parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "en", mode: "chat" }).error, "invalid_mode");
});

test("request: client gating is opt-in with a strict boolean", () => {
  assert.equal(parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "en" }).clientGating, false);
  assert.equal(parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "en", clientGating: "true" }).clientGating, false);
  assert.equal(parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "en", clientGating: 1 }).clientGating, false);
  assert.equal(parseMedaSessionRequest({ patientLanguage: "de", practiceLanguage: "en", clientGating: true }).clientGating, true);
});

test("old client (no clientGating): the model answers on its own, exactly as before", () => {
  const { session, responseGating } = buildMedaRealtimeSession({ ...BASE });
  assert.equal(responseGating, RESPONSE_GATING.SERVER);
  assert.deepEqual(session, {
    type: "realtime",
    model: "gpt-realtime",
    instructions: "INTERPRETER-INSTRUCTIONS",
    max_output_tokens: "inf",
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: "gpt-4o-transcribe" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 200,
          silence_duration_ms: 1500,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { voice: "marin" },
    },
  }, "byte-for-byte the session the route built before gating existed");
});

test("new client: the model does not answer until the client asks", () => {
  const { session, responseGating } = buildMedaRealtimeSession({ ...BASE, clientGating: true });
  assert.equal(responseGating, RESPONSE_GATING.CLIENT);
  assert.equal(session.audio.input.turn_detection.create_response, false);
  assert.equal(session.audio.input.turn_detection.interrupt_response, true, "barge-in unchanged");
  assert.equal(session.audio.input.turn_detection.threshold, 0.5, "VAD unchanged — no extra background suppression");
  assert.equal(session.instructions, "INTERPRETER-INSTRUCTIONS", "interpreter instructions unchanged");
  assert.equal("noise_reduction" in session.audio.input, false, "no provider-side noise filtering added");
});

test("rollback switch restores the server-driven flow even for new clients", () => {
  for (const value of ["false", "FALSE", " 0 "]) {
    const { session, responseGating } = buildMedaRealtimeSession({
      ...BASE, clientGating: true, env: { MEDA_REALTIME_GATED_RESPONSES: value },
    });
    assert.equal(responseGating, RESPONSE_GATING.SERVER, value);
    assert.equal(session.audio.input.turn_detection.create_response, true, value);
  }
  assert.equal(isClientResponseGatingEnabled({}), true);
  assert.equal(isClientResponseGatingEnabled({ MEDA_REALTIME_GATED_RESPONSES: "true" }), true);
});

test("transcription: never answers, never translates, never speaks — even with the rollback switch", () => {
  for (const env of [{}, { MEDA_REALTIME_GATED_RESPONSES: "false" }]) {
    for (const clientGating of [false, true]) {
      const { session, responseGating } = buildMedaRealtimeSession({ ...BASE, mode: "transcription", clientGating, env });
      assert.equal(responseGating, RESPONSE_GATING.NONE);
      assert.equal(session.audio.input.turn_detection.create_response, false);
      assert.equal(session.audio.input.turn_detection.interrupt_response, false);
      assert.deepEqual(session.output_modalities, ["text"], "no audio output at all");
      assert.equal(session.instructions, TRANSCRIPTION_SESSION_INSTRUCTIONS);
      assert.ok(!session.instructions.includes("INTERPRETER"), "interpreter instructions not used");
      assert.equal(session.audio.input.turn_detection.threshold, 0.5, "same VAD, no extra suppression");
    }
  }
});

test("no fixed transcription language (foreign speech must stay visible to the check)", () => {
  for (const [mode, clientGating] of [["interpretation", false], ["interpretation", true], ["transcription", true]]) {
    const { session } = buildMedaRealtimeSession({ ...BASE, mode, clientGating });
    assert.equal(session.audio.input.transcription.language, undefined);
    assert.equal(session.audio.input.transcription.model, "gpt-4o-transcribe");
  }
});

test("route: validation and session construction go through the config module", () => {
  const src = fs.readFileSync(path.join(SERVER, "routes/medaRealtime.js"), "utf8");
  assert.match(src, /parseMedaSessionRequest\(req\.body\)/);
  assert.match(src, /buildMedaRealtimeSession\(\{/);
  assert.match(src, /clientGating,/, "the client's opt-in reaches the builder");
  assert.match(src, /mode,\n\s+clientGating,/, "the parsed mode reaches the builder");
  assert.match(src, /responseGating,/, "the client is told which flow it got");
  assert.ok(!/create_response:\s*true/.test(src), "no hard-coded auto-response left in the route");
});
