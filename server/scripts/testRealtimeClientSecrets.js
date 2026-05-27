import "dotenv/config";
import { buildLiveTranslationInstructions } from "../services/liveTranslation/liveTranslationPrompt.js";
import {
  getOpenAiRealtimeModel,
  getOpenAiTranscriptionModel,
} from "../config/openAiModels.js";

// POST /v1/realtime/client_secrets uses RealtimeSessionCreateRequestGA:
//   session.output_modalities (NOT session.modalities)
//   session.audio.input.transcription (NOT session.input_audio_transcription)
//   session.audio.input.turn_detection (NOT session.turn_detection)
//   session.audio.output.voice (NOT session.voice)
//   session.audio.output.speed (NOT session.output_audio_speed)
// Source: openai/openai-openapi RealtimeSessionCreateRequestGA schema

const URL = "https://api.openai.com/v1/realtime/client_secrets";
const key = process.env.OPENAI_API_KEY;

const REALTIME_MODEL = getOpenAiRealtimeModel();
const TRANSCRIPTION_MODEL = getOpenAiTranscriptionModel();

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

// --- Minimal valid payload (baseline) ---
await test("minimal_valid", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
  },
});

// --- output_modalities: ["audio"] ---
await test("output_modalities_audio", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
  },
});

// --- Full production payload using GA schema ---
const instructions = buildLiveTranslationInstructions({
  patientLanguage: "de",
  doctorLanguage: "en",
  activeSpeaker: "patient",
});

await test("full_production_payload_ga", {
  expires_after: { anchor: "created_at", seconds: 600 },
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    instructions,
    audio: {
      input: {
        transcription: {
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
      output: {
        voice: "marin",
        speed: 0.9,
      },
    },
  },
});

// --- Transcription without language lock (multi-speaker auto-detect) ---
await test("transcription_auto_detect", {
  expires_after: { anchor: "created_at", seconds: 600 },
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: TRANSCRIPTION_MODEL },
        turn_detection: {
          type: "server_vad",
          create_response: false,
          interrupt_response: true,
          silence_duration_ms: 1100,
          threshold: 0.64,
        },
      },
      output: {
        voice: "marin",
      },
    },
  },
});

// --- Language codes --- (should all succeed)
const langs = [
  "de", "en", "fr", "es", "it", "ru", "uk", "tr", "pt", "ar", "fa", "pl", "ro", "nl",
  "el", "sq", "hr", "bs", "sr", "he", "ur",
];

for (const lang of langs) {
  await test(`lang_${lang}`, {
    session: {
      type: "realtime",
      model: REALTIME_MODEL,
      output_modalities: ["audio"],
      audio: {
        input: {
          transcription: { model: TRANSCRIPTION_MODEL, language: lang },
        },
      },
    },
  });
}

// --- Rejection tests ---

// Legacy field: session.modalities (should reject)
await test("legacy_modalities_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    modalities: ["audio"],
  },
});

// Legacy field: session.voice (should reject)
await test("legacy_session_voice_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    voice: "marin",
  },
});

// Legacy field: session.input_audio_transcription (should reject)
await test("legacy_input_audio_transcription_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    input_audio_transcription: { model: TRANSCRIPTION_MODEL, language: "de" },
  },
});

// Legacy field: session.turn_detection at root (should reject)
await test("legacy_turn_detection_root_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    turn_detection: { type: "server_vad" },
  },
});

// Wrong type: silence_duration_ms as string (should reject)
await test("vad_silence_string_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    audio: {
      input: {
        turn_detection: { type: "server_vad", silence_duration_ms: "1100" },
      },
    },
  },
});

// Wrong type: speed as string (should reject)
await test("speed_string_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    audio: { output: { speed: "0.9" } },
  },
});

// Wrong type: expires_after.seconds as string (should reject)
await test("expires_bad_string_should_reject", {
  expires_after: { anchor: "created_at", seconds: "600" },
  session: { type: "realtime", model: REALTIME_MODEL },
});

// Bad transcription model (should reject)
await test("bad_transcription_model_should_reject", {
  session: {
    type: "realtime",
    model: REALTIME_MODEL,
    audio: {
      input: {
        transcription: { model: "whisper-2", language: "de" },
      },
    },
  },
});

// Chat model used as realtime (should reject)
await test("chat_model_as_realtime_should_reject", {
  session: {
    type: "realtime",
    model: "gpt-5.4",
  },
});
