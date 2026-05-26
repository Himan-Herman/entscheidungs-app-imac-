import "dotenv/config";
import { buildLiveTranslationInstructions } from "../services/liveTranslation/liveTranslationPrompt.js";
import {
  getOpenAiRealtimeModel,
  getOpenAiTranscriptionModel,
} from "../config/openAiModels.js";

const URL = "https://api.openai.com/v1/realtime/client_secrets";
const key = process.env.OPENAI_API_KEY;

const REALTIME_MODEL = getOpenAiRealtimeModel();       // gpt-realtime-2
const TRANSCRIPTION_MODEL = getOpenAiTranscriptionModel(); // gpt-4o-transcribe

async function test(name, payload) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  const err = data?.error;
  if (!res.ok) {
    console.log(
      JSON.stringify({
        test: name,
        status: res.status,
        param: err?.param ?? null,
        code: err?.code ?? null,
        message: err?.message ?? null,
      }),
    );
  } else {
    console.log(JSON.stringify({ test: name, status: res.status, ok: true }));
  }
}

// Session fields must be at the session root — not nested under audio.input.*
// This is the same structure used by liveTranslationRealtimeService.js in production.
const langs = [
  "de", "en", "fr", "es", "it", "ru", "uk", "tr", "pt", "ar", "fa", "pl", "ro", "nl",
  "ckb", "ku", "el", "sq", "hr", "bs", "sr", "he", "ur",
];

for (const lang of langs) {
  await test(`lang_${lang}`, {
    session: {
      type: "realtime",
      model: REALTIME_MODEL,
      modalities: ["audio"],
      voice: "marin",
      input_audio_transcription: {
        model: TRANSCRIPTION_MODEL,
        language: lang,
      },
    },
  });
}

const instructions = buildLiveTranslationInstructions({
  patientLanguage: "de",
  doctorLanguage: "en",
  activeSpeaker: "patient",
});

await test("full_production_payload", {
  expires_after: { anchor: "created_at", seconds: 600 },
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    modalities: ["audio"],
    instructions,
    voice: "marin",
    output_audio_speed: 0.9,
    input_audio_transcription: {
      model: TRANSCRIPTION_MODEL,
      language: "de",
    },
    turn_detection: {
      type: "server_vad",
      create_response: false,
      interrupt_response: true,
      silence_duration_ms: 1100,
      prefix_padding_ms: 500,
      threshold: 0.64,
    },
  },
});

await test("no_transcription_language_multi_speaker", {
  expires_after: { anchor: "created_at", seconds: 600 },
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    modalities: ["audio"],
    voice: "marin",
    input_audio_transcription: {
      model: TRANSCRIPTION_MODEL,
    },
    turn_detection: {
      type: "server_vad",
      create_response: false,
      interrupt_response: true,
      silence_duration_ms: 1100,
      threshold: 0.64,
    },
  },
});

await test("vad_silence_string_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    modalities: ["audio"],
    turn_detection: { type: "server_vad", silence_duration_ms: "1100" },
  },
});

await test("speed_string_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    modalities: ["audio"],
    voice: "marin",
    output_audio_speed: "0.9",
  },
});

await test("expires_bad_string_should_reject", {
  expires_after: { anchor: "created_at", seconds: "600" },
  session: { type: "realtime", model: REALTIME_MODEL, modalities: ["audio"] },
});

await test("bad_transcription_model_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    modalities: ["audio"],
    input_audio_transcription: { model: "whisper-2", language: "de" },
  },
});

await test("chat_model_as_realtime_should_reject", {
  session: {
    type: "realtime",
    model: "gpt-5.4",
    modalities: ["audio"],
    voice: "marin",
  },
});
