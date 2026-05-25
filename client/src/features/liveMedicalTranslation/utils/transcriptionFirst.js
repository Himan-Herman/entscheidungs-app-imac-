import { isLikelyEmptyOrNoiseTranscript } from "./asrQuality.js";

/** Minimum characters for a stable transcript before translation (conservative). */
export const MIN_STABLE_TRANSCRIPT_CHARS = 2;

/** Max wait for ASR after translation audio completes (ms). */
export const MAX_TRANSCRIPT_WAIT_MS = 2200;

/**
 * Transcription-first: translation only after a completed, non-noise transcript exists.
 * @param {{
 *   transcript?: string;
 *   inputState?: "pending" | "ready" | "empty" | "failed";
 *   scopeTranslationPaused?: boolean;
 * }} input
 */
export function canProceedToTranslation(input) {
  if (input.scopeTranslationPaused) return false;
  if (input.inputState !== "ready") return false;
  const text = String(input.transcript || "").trim();
  if (!text || isLikelyEmptyOrNoiseTranscript(text)) return false;
  if (text.length < MIN_STABLE_TRANSCRIPT_CHARS) return false;
  return true;
}

/**
 * @param {string} transcript
 * @param {"pending" | "ready" | "empty" | "failed"} inputState
 */
export function isStableTranscriptReady(transcript, inputState) {
  return canProceedToTranslation({ transcript, inputState, scopeTranslationPaused: false });
}
