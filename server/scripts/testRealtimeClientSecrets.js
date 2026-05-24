import "dotenv/config";
import { buildLiveTranslationInstructions } from "../services/liveTranslation/liveTranslationPrompt.js";

const URL = "https://api.openai.com/v1/realtime/client_secrets";
const key = process.env.OPENAI_API_KEY;

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
        test,
        status: res.status,
        param: err?.param ?? null,
        code: err?.code ?? null,
        message: err?.message ?? null,
      }),
    );
  } else {
    console.log(JSON.stringify({ test, status: res.status, ok: true }));
  }
}

const langs = [
  "de", "en", "fr", "es", "it", "ru", "uk", "tr", "pt", "ar", "fa", "pl", "ro", "nl",
  "ckb", "ku", "el", "sq", "hr", "bs", "sr", "he", "ur",
];

for (const lang of langs) {
  await test(`lang_${lang}`, {
    session: {
      type: "realtime",
      model: "gpt-realtime",
      audio: {
        input: { transcription: { model: "gpt-4o-mini-transcribe", language: lang } },
        output: { voice: "marin" },
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
    model: "gpt-realtime",
    instructions,
    output_modalities: ["audio"],
    audio: {
      input: {
        turn_detection: {
          type: "server_vad",
          create_response: true,
          interrupt_response: true,
          silence_duration_ms: 550,
        },
        transcription: { model: "gpt-4o-mini-transcribe", language: "de" },
      },
      output: { voice: "marin", speed: 0.9 },
    },
  },
});

await test("vad_string", {
  session: {
    type: "realtime",
    model: "gpt-realtime",
    audio: {
      input: { turn_detection: { type: "server_vad", silence_duration_ms: "550" } },
      output: { voice: "marin" },
    },
  },
});

await test("speed_string", {
  session: {
    type: "realtime",
    model: "gpt-realtime",
    audio: { output: { voice: "marin", speed: "0.9" } },
  },
});

await test("expires_bad", {
  expires_after: { anchor: "created_at", seconds: "600" },
  session: { type: "realtime", model: "gpt-realtime" },
});

await test("transcription_bad_model", {
  session: {
    type: "realtime",
    model: "gpt-realtime",
    audio: {
      input: { transcription: { model: "whisper-2", language: "de" } },
      output: { voice: "marin" },
    },
  },
});
