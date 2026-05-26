import {
  getOpenAiRealtimeModel,
  getOpenAiTranscriptionModel,
  getOpenAiTtsModel,
} from "./openAiModels.js";

/**
 * neutral_medical voice profile — calm, clear, balanced Realtime output for doctor–patient translation.
 * OpenAI built-in voices: marin is GA-recommended for quality; sage is the fallback calm/neutral option.
 */
export const LIVE_TRANSLATION_VOICE_PROFILE = "neutral_medical";

/**
 * OpenAI Realtime model for live medical conversation (WebRTC audio layer).
 * Default: gpt-4o-realtime-preview — officially documented OpenAI Realtime model.
 * GPT-5.4 is a chat/text model and must NOT be used here.
 */
export const LIVE_TRANSLATION_REALTIME_MODEL = getOpenAiRealtimeModel();

/**
 * Voice for Realtime output — calm, neutral, professional for healthcare.
 * marin: clear and balanced; not hectic or strongly gendered.
 * Override with LIVE_TRANSLATION_VOICE env var.
 */
export const LIVE_TRANSLATION_VOICE = process.env.LIVE_TRANSLATION_VOICE || "marin";

/**
 * Input transcription model (Realtime ASR layer).
 * gpt-4o-transcribe: highest medical speech accuracy.
 * Override with LIVE_TRANSLATION_TRANSCRIPTION_MODEL env var.
 */
export const LIVE_TRANSLATION_TRANSCRIPTION_MODEL = getOpenAiTranscriptionModel();

/**
 * TTS model for any non-Realtime speech synthesis in the Meda pipeline.
 * Override with OPENAI_TTS_MODEL env var.
 */
export const LIVE_TRANSLATION_TTS_MODEL = getOpenAiTtsModel();

function clampOutputSpeed(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0.9;
  return Math.min(1.5, Math.max(0.25, value));
}

function safeIntegerEnv(raw, fallback) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.round(value);
}

/**
 * Output speech speed (0.25–1.5). Slightly below 1.0 for moderate medical-conversation pacing.
 */
export const LIVE_TRANSLATION_OUTPUT_SPEED = clampOutputSpeed(
  process.env.LIVE_TRANSLATION_OUTPUT_SPEED || 0.9,
);

/** Client secret TTL (seconds). OpenAI allows 10–7200; default 10 minutes. */
export const LIVE_TRANSLATION_CLIENT_SECRET_TTL_SECONDS = safeIntegerEnv(
  process.env.LIVE_TRANSLATION_CLIENT_SECRET_TTL_SECONDS,
  600,
);

/** Server VAD silence before end-of-turn (ms). 700–900 ms helps short medical phrases. */
export const LIVE_TRANSLATION_VAD_SILENCE_MS = safeIntegerEnv(
  process.env.LIVE_TRANSLATION_VAD_SILENCE_MS,
  1100,
);

/** Server VAD activation threshold (0–1). Higher = less sensitive to background noise. */
export const LIVE_TRANSLATION_VAD_THRESHOLD = (() => {
  const value = Number(process.env.LIVE_TRANSLATION_VAD_THRESHOLD);
  if (!Number.isFinite(value)) return 0.64;
  return Math.min(1, Math.max(0, value));
})();
