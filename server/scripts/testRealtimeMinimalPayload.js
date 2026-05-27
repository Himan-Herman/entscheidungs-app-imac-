/**
 * testRealtimeMinimalPayload.js
 *
 * Incremental payload verification against POST /v1/realtime/client_secrets.
 * Starts with the smallest possible valid payload and adds fields one at a time.
 * Run with: node --env-file=.env server/scripts/testRealtimeMinimalPayload.js
 *
 * Schema: RealtimeSessionCreateRequestGA (openai/openai-openapi)
 * Required field: session.type = "realtime"
 * All audio config is nested under session.audio.input / session.audio.output
 */

import "dotenv/config";
import { getOpenAiRealtimeModel, getOpenAiTranscriptionModel } from "../config/openAiModels.js";

const URL = "https://api.openai.com/v1/realtime/client_secrets";
const key = process.env.OPENAI_API_KEY;

if (!key) {
  console.error("OPENAI_API_KEY not set");
  process.exit(1);
}

const REALTIME_MODEL = getOpenAiRealtimeModel();
const TRANSCRIPTION_MODEL = getOpenAiTranscriptionModel();

let passed = 0;
let failed = 0;

async function test(name, payload, expectOk = true) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  const actualOk = res.ok;
  const pass = expectOk ? actualOk : !actualOk;

  const result = {
    test: name,
    pass,
    status: res.status,
    expectedOk: expectOk,
    ...(res.ok ? {} : {
      param: data?.error?.param ?? null,
      code: data?.error?.code ?? null,
      message: data?.error?.message ?? null,
    }),
  };

  console.log(JSON.stringify(result));
  if (pass) passed++; else failed++;
  return { ok: actualOk, data };
}

console.log(`\n=== Realtime Minimal Payload Tests ===`);
console.log(`Model: ${REALTIME_MODEL}`);
console.log(`Transcription: ${TRANSCRIPTION_MODEL}\n`);

// Step 1: Minimal — just type + model (must succeed)
await test("step1_minimal_type_and_model", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
  },
});

// Step 2: Add output_modalities (must succeed)
await test("step2_add_output_modalities", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
  },
});

// Step 3: Add expires_after (must succeed)
await test("step3_add_expires_after", {
  expires_after: { anchor: "created_at", seconds: 600 },
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
  },
});

// Step 4: Add audio.output.voice (must succeed)
await test("step4_add_voice", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    audio: {
      output: { voice: "marin" },
    },
  },
});

// Step 5: Add audio.output.speed (must succeed)
await test("step5_add_speed", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    audio: {
      output: { voice: "marin", speed: 0.9 },
    },
  },
});

// Step 6: Add audio.input.transcription (must succeed)
await test("step6_add_transcription", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: TRANSCRIPTION_MODEL, language: "de" },
      },
      output: { voice: "marin", speed: 0.9 },
    },
  },
});

// Step 7: Add audio.input.turn_detection (must succeed)
await test("step7_add_turn_detection", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: TRANSCRIPTION_MODEL, language: "de" },
        turn_detection: {
          type: "server_vad",
          create_response: false,
          interrupt_response: true,
          silence_duration_ms: 1100,
          prefix_padding_ms: 500,
          threshold: 0.64,
        },
      },
      output: { voice: "marin", speed: 0.9 },
    },
  },
});

// Step 8: Add instructions (must succeed — full production payload)
await test("step8_full_production", {
  expires_after: { anchor: "created_at", seconds: 600 },
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    instructions: "You are a professional medical interpreter. Translate accurately and concisely.",
    audio: {
      input: {
        transcription: { model: TRANSCRIPTION_MODEL, language: "de" },
        turn_detection: {
          type: "server_vad",
          create_response: false,
          interrupt_response: true,
          silence_duration_ms: 1100,
          prefix_padding_ms: 500,
          threshold: 0.64,
        },
      },
      output: { voice: "marin", speed: 0.9 },
    },
  },
});

// --- Verify legacy fields are correctly rejected ---
await test("reject_session_modalities", {
  session: { type: "realtime", model: REALTIME_MODEL, modalities: ["audio"] },
}, false);

await test("reject_session_voice", {
  session: { type: "realtime", model: REALTIME_MODEL, voice: "marin" },
}, false);

await test("reject_session_input_audio_transcription", {
  session: { type: "realtime", model: REALTIME_MODEL, input_audio_transcription: { model: TRANSCRIPTION_MODEL } },
}, false);

await test("reject_session_turn_detection_root", {
  session: { type: "realtime", model: REALTIME_MODEL, turn_detection: { type: "server_vad" } },
}, false);

await test("reject_session_output_audio_speed", {
  session: { type: "realtime", model: REALTIME_MODEL, output_audio_speed: 0.9 },
}, false);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
