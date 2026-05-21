import { toFile } from "openai";
import { openai } from "../../openaiClient.js";
import { isInterpreterAiConfigured } from "../../config/interpreterEnv.js";
import {
  normalizeTranscribeLanguageHint,
  sanitizeUploadFilename,
  validateTranscriptOutput,
} from "./interpreterInputSafety.js";

/**
 * @param {import('openai').OpenAI.Audio.Transcriptions.Transcription & { segments?: { avg_logprob?: number }[] }} data
 * @returns {'high' | 'medium' | 'low' | undefined}
 */
function deriveTranscriptionConfidence(data) {
  const segments = data?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return undefined;
  const scores = segments
    .map((s) => (typeof s.avg_logprob === "number" ? s.avg_logprob : null))
    .filter((n) => n != null);
  if (scores.length === 0) return undefined;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg > -0.35) return "high";
  if (avg > -0.7) return "medium";
  return "low";
}

/**
 * @param {{ buffer: Buffer, originalname?: string, mimetype?: string, languageHint?: string }} params
 * @returns {Promise<{ ok: true, transcript: string, language?: string, confidence?: string } | { ok: false, code: string, message: string, statusCode: number }>}
 */
export async function transcribeInterpreterAudio(params) {
  if (!isInterpreterAiConfigured()) {
    return {
      ok: false,
      code: "interpreter_unavailable",
      message: "Transcription is not configured. Please try again later.",
      statusCode: 503,
    };
  }

  const { buffer, originalname, mimetype } = params;
  const filename = sanitizeUploadFilename(originalname);
  const type =
    mimetype && String(mimetype).trim() ? String(mimetype).trim() : "audio/webm";
  const langHint = normalizeTranscribeLanguageHint(params.languageHint);

  try {
    const file = await toFile(buffer, filename, { type });
    /** @type {import('openai').OpenAI.Audio.TranscriptionCreateParams} */
    const createParams = {
      file,
      model: "whisper-1",
      response_format: "verbose_json",
    };
    if (langHint) createParams.language = langHint;

    const transcription = await openai.audio.transcriptions.create(createParams);
    const rawTranscript =
      transcription.text != null ? String(transcription.text).trim() : "";
    const safe = validateTranscriptOutput(rawTranscript);
    if (!safe.ok) {
      return {
        ok: false,
        code: safe.code,
        message: safe.message,
        statusCode: 400,
      };
    }

    return {
      ok: true,
      transcript: safe.transcript,
      language: transcription.language || langHint || undefined,
      confidence: deriveTranscriptionConfidence(transcription),
    };
  } catch {
    return {
      ok: false,
      code: "transcription_failed",
      message: "Transcription could not be completed. Please try again.",
      statusCode: 502,
    };
  }
}
