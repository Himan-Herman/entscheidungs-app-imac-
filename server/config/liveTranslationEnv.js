/**
 * neutral_medical voice profile — calm, clear, balanced Realtime output for doctor–patient translation.
 * OpenAI built-in voices: marin is GA-recommended for quality; sage is the fallback calm/neutral option.
 */
export const LIVE_TRANSLATION_VOICE_PROFILE = "neutral_medical";

/** OpenAI Realtime model for live medical conversation translation. */
export const LIVE_TRANSLATION_REALTIME_MODEL =
  process.env.LIVE_TRANSLATION_REALTIME_MODEL || "gpt-realtime";

/**
 * Voice mapped from neutral_medical profile.
 * marin: calm, clear, professional; not playful or strongly gendered (OpenAI GA recommendation).
 * Override with LIVE_TRANSLATION_VOICE if needed.
 */
export const LIVE_TRANSLATION_VOICE = process.env.LIVE_TRANSLATION_VOICE || "marin";

/**
 * Input transcription model (required by Realtime API when transcription is enabled).
 */
export const LIVE_TRANSLATION_TRANSCRIPTION_MODEL =
  process.env.LIVE_TRANSLATION_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";

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

/** Server VAD silence before end-of-turn (ms). Lower = snappier responses; default 550. */
export const LIVE_TRANSLATION_VAD_SILENCE_MS = safeIntegerEnv(
  process.env.LIVE_TRANSLATION_VAD_SILENCE_MS,
  550,
);
