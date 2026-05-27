import { extractDetectedLanguage, extractOriginalText } from "./webrtc.js";
import { isLikelyEmptyOrNoiseTranscript } from "./asrQuality.js";
import { logRealtimeDiag } from "./realtimeDiagnostics.js";

/** Wait for stable input ASR after translation before finalizing a turn (ms). */
export const LIVE_TRANSLATION_ORIGINAL_BUFFER_MS = 1400;

const INPUT_TRANSCRIPTION_EVENT_TYPES = new Set([
  "conversation.item.input_audio_transcription.completed",
  "conversation.item.input_audio_transcription.failed",
  "input_audio_buffer.transcription.completed",
  "input_audio_buffer.transcription.failed",
  "conversation.item.input_audio_transcription.delta",
  "input_audio_buffer.transcription.delta",
]);

/**
 * @param {unknown} event
 * @returns {boolean}
 */
export function isInputTranscriptionEvent(event) {
  if (!event || typeof event !== "object") return false;
  const type = /** @type {{ type?: string }} */ (event).type;
  return typeof type === "string" && INPUT_TRANSCRIPTION_EVENT_TYPES.has(type);
}

/**
 * @param {unknown} event
 * @returns {boolean}
 */
export function isInputTranscriptionCompletedEvent(event) {
  if (!event || typeof event !== "object") return false;
  const type = /** @type {{ type?: string }} */ (event).type;
  return (
    type === "conversation.item.input_audio_transcription.completed" ||
    type === "input_audio_buffer.transcription.completed"
  );
}

/**
 * @param {unknown} event
 * @returns {boolean}
 */
export function isInputTranscriptionFailedEvent(event) {
  if (!event || typeof event !== "object") return false;
  const type = /** @type {{ type?: string }} */ (event).type;
  return (
    type === "conversation.item.input_audio_transcription.failed" ||
    type === "input_audio_buffer.transcription.failed"
  );
}

/**
 * @param {Record<string, unknown>} event
 * @returns {number | null}
 */
export function extractTranscriptionConfidence(event) {
  if (!event || typeof event !== "object") return null;
  if (typeof event.confidence === "number" && Number.isFinite(event.confidence)) {
    return event.confidence;
  }
  const transcription = event.transcription;
  if (transcription && typeof transcription === "object") {
    const conf = /** @type {{ confidence?: number }} */ (transcription).confidence;
    if (typeof conf === "number" && Number.isFinite(conf)) return conf;
  }
  if (event.logprobs != null) return null;
  return null;
}

/**
 * Safe metadata for dev diagnostics — no transcript text or patient data.
 * @param {Record<string, unknown>} event
 */
export function summarizeTranscriptionEvent(event) {
  const transcript = extractOriginalText(event);
  const detected = extractDetectedLanguage(event);
  const failed = isInputTranscriptionFailedEvent(event);
  const noise = transcript ? isLikelyEmptyOrNoiseTranscript(transcript) : true;

  return {
    type: typeof event.type === "string" ? event.type : null,
    hasTranscript: transcript.length > 0,
    transcriptLength: transcript.length,
    language: detected || null,
    confidence: extractTranscriptionConfidence(event),
    failed,
    noiseOnly: Boolean(transcript && noise),
  };
}

/**
 * @param {Record<string, unknown>} event
 */
export function logTranscriptionEventMeta(event) {
  if (!isInputTranscriptionEvent(event)) return;
  const meta = summarizeTranscriptionEvent(event);
  logRealtimeDiag("transcription_event", meta);
  if (import.meta.env?.DEV) {
    console.info("[MedaRealtimeConnect]", {
      event: isInputTranscriptionCompletedEvent(event) ? "transcript_final" : "transcript_partial",
      ...meta,
    });
  }
}
