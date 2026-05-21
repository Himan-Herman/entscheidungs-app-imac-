import { openai } from "../../openaiClient.js";
import { isInterpreterAiConfigured } from "../../config/interpreterEnv.js";

const DEFAULT_TTS_MODEL = "tts-1";

/** OpenAI TTS voice for neutral preference (no generative rewrite). */
const VOICE_NEUTRAL = "alloy";

/**
 * @param {string} [preference]
 */
function resolveOpenAiVoice(preference) {
  if (preference === "neutral" || !preference) return VOICE_NEUTRAL;
  return VOICE_NEUTRAL;
}

export function getInterpreterTtsModel() {
  const model = process.env.INTERPRETER_TTS_MODEL || process.env.OPENAI_TTS_MODEL;
  return typeof model === "string" && model.trim() ? model.trim() : DEFAULT_TTS_MODEL;
}

/**
 * Text-to-speech only — reads the submitted text verbatim (no LLM, no medical generation).
 *
 * @param {{ text: string, language: string, voicePreference?: string }} params
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

  const voice = resolveOpenAiVoice(params.voicePreference);
  void params.language;

  try {
    const speech = await openai.audio.speech.create({
      model: getInterpreterTtsModel(),
      voice,
      input: params.text,
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
