import { openai } from "../../openaiClient.js";
import { isInterpreterAiConfigured } from "../../config/interpreterEnv.js";

const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";

/** Legacy fallback voice that works across older OpenAI TTS models. */
const VOICE_NEUTRAL = "alloy";
/** Higher-quality neutral voice used when the configured model supports it. */
const VOICE_NEUTRAL_MEDICAL = "cedar";

const VOICE_SPEEDS = {
  normal: 0.96,
  slow: 0.88,
};

function supportsAdvancedInterpreterTts(model) {
  return /^gpt-4o-mini-tts$/i.test(String(model || "").trim());
}

/**
 * @param {string} [preference]
 * @param {string} [language]
 * @param {string} [model]
 */
function resolveOpenAiVoice(preference, language, model) {
  void language;
  if (preference === "neutral_medical" && supportsAdvancedInterpreterTts(model)) {
    return VOICE_NEUTRAL_MEDICAL;
  }
  if (preference === "neutral" || preference === "neutral_medical" || !preference) {
    return VOICE_NEUTRAL;
  }
  return VOICE_NEUTRAL;
}

/**
 * @param {string} [voiceSpeed]
 */
function resolveSpeechSpeed(voiceSpeed) {
  if (voiceSpeed === "slow") return VOICE_SPEEDS.slow;
  return VOICE_SPEEDS.normal;
}

/**
 * @param {string} [preference]
 * @param {string} [language]
 * @param {string} [voiceSpeed]
 * @param {string} [model]
 */
function resolveSpeechInstructions(preference, language, voiceSpeed, model) {
  if (!supportsAdvancedInterpreterTts(model)) return undefined;
  if (preference !== "neutral_medical") return undefined;

  const pacing =
    voiceSpeed === "slow"
      ? "Speak slowly, calmly, and evenly for patient understanding."
      : "Speak calmly, clearly, and evenly at a measured pace.";

  return [
    `Read the text exactly as written in ${language || "the target language"}.`,
    "Use a professional, neutral, healthcare-appropriate interpreter voice.",
    pacing,
    "Avoid dramatic intonation, playful delivery, and marketing-style emphasis.",
    "Keep pronunciation precise and balanced.",
  ].join(" ");
}

export function getInterpreterTtsModel() {
  const model = process.env.INTERPRETER_TTS_MODEL || process.env.OPENAI_TTS_MODEL;
  return typeof model === "string" && model.trim() ? model.trim() : DEFAULT_TTS_MODEL;
}

/**
 * Text-to-speech only — reads the submitted text verbatim (no LLM, no medical generation).
 *
 * @param {{ text: string, language: string, voicePreference?: string, voiceSpeed?: string }} params
 * @returns {Promise<
 *   | { ok: true, buffer: Buffer, contentType: string }
 *   | { ok: false, code: string, message: string, statusCode: number }
 * >}
 */
export async function synthesizeInterpreterSpeech(params) {
  if (!isInterpreterAiConfigured()) {
    return {
      ok: false,
      code: "interpreter_unavailable",
      message: "Speech playback is not configured. Please try again later.",
      statusCode: 503,
    };
  }

  const model = getInterpreterTtsModel();
  const voice = resolveOpenAiVoice(
    params.voicePreference,
    params.language,
    model,
  );
  const speed = resolveSpeechSpeed(params.voiceSpeed);
  const instructions = resolveSpeechInstructions(
    params.voicePreference,
    params.language,
    params.voiceSpeed,
    model,
  );

  try {
    const speech = await openai.audio.speech.create({
      model,
      voice,
      input: params.text,
      speed,
      ...(instructions ? { instructions } : {}),
      response_format: "mp3",
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    return { ok: true, buffer, contentType: "audio/mpeg" };
  } catch (_err) {
    return {
      ok: false,
      code: "speech_failed",
      message: "Speech playback is temporarily unavailable. Please try again.",
      statusCode: 502,
    };
  }
}

// TODO: Re-evaluate provider voice coverage if multilingual neutrality is not strong
// enough across all supported interpreter languages.
