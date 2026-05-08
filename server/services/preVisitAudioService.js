/**
 * Pre-Visit audio: OpenAI TTS and transcription for intake only.
 *
 * Audio processing sends user audio/text to OpenAI for transcription or speech generation.
 * No audio is stored by this service.
 */
import { openai } from '../openaiClient.js';
import { toFile } from 'openai/uploads';

export const PREVISIT_SPEAK_MAX_CHARS = 1200;

const TTS_MODEL = 'tts-1';

/**
 * @param {unknown} body
 * @returns {{ text: string, language?: string }}
 */
export function parseSpeakRequest(body) {
  const raw = body?.text != null ? String(body.text) : '';
  if (raw.length > PREVISIT_SPEAK_MAX_CHARS) {
    const err = new Error('TEXT_TOO_LONG');
    err.statusCode = 400;
    err.safeMessage = `Text must be at most ${PREVISIT_SPEAK_MAX_CHARS} characters.`;
    throw err;
  }
  const text = raw.trim();
  if (!text) {
    const err = new Error('TEXT_REQUIRED');
    err.statusCode = 400;
    err.safeMessage = 'Text is required.';
    throw err;
  }
  const language =
    body?.language != null && String(body.language).trim()
      ? String(body.language).trim().slice(0, 12)
      : undefined;
  return { text, language };
}

/**
 * @param {{ text: string, language?: string }} params
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
export async function synthesizePreVisitSpeech(params) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new Error('MISSING_API_KEY');
    err.statusCode = 503;
    err.safeMessage = 'The service is not configured correctly. Please try again later.';
    throw err;
  }

  void params.language;

  try {
    const speech = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: 'alloy',
      input: params.text,
      response_format: 'mp3',
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    return { buffer, contentType: 'audio/mpeg' };
  } catch (err) {
    const wrap = new Error('OPENAI_TTS_FAILED');
    wrap.statusCode = 502;
    wrap.safeMessage = 'Speech generation is temporarily unavailable. Please try again later.';
    wrap.cause = err;
    throw wrap;
  }
}

/**
 * @param {{ buffer: Buffer, originalname?: string, mimetype?: string, language?: string }} params
 * @returns {Promise<{ text: string }>}
 */
export async function transcribePreVisitAudio(params) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new Error('MISSING_API_KEY');
    err.statusCode = 503;
    err.safeMessage = 'The service is not configured correctly. Please try again later.';
    throw err;
  }

  const { buffer, originalname, mimetype } = params;
  const filename = (originalname && String(originalname).trim()) || 'recording.webm';
  const type = mimetype && String(mimetype).trim() ? String(mimetype).trim() : 'audio/webm';

  let langOpt;
  if (params.language != null && String(params.language).trim()) {
    const l = String(params.language).trim().toLowerCase().slice(0, 5);
    if (/^[a-z]{2}(-[a-z]{2})?$/.test(l)) {
      langOpt = l.split('-')[0];
    }
  }

  try {
    const file = await toFile(buffer, filename, { type });
    const createParams = { file, model: 'whisper-1' };
    if (langOpt) createParams.language = langOpt;

    const transcription = await openai.audio.transcriptions.create(createParams);
    const text = transcription.text != null ? String(transcription.text) : '';
    return { text };
  } catch (err) {
    const wrap = new Error('OPENAI_TRANSCRIBE_FAILED');
    wrap.statusCode = 502;
    wrap.safeMessage =
      'Transcription is temporarily unavailable. Please try again later.';
    wrap.cause = err;
    throw wrap;
  }
}
