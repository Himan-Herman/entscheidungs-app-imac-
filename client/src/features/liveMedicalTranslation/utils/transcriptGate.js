import { isLikelyEmptyOrNoiseTranscript } from "./asrQuality.js";
import {
  canProceedToTranslation,
  MIN_STABLE_TRANSCRIPT_CHARS,
} from "./transcriptionFirst.js";
import { normalizeTranscriptKey } from "./costGuard.js";
import { extractOriginalText, extractTranslatedText, extractTranslatedTextFromResponse } from "./webrtc.js";
import { extractTranscriptionConfidence } from "./asrTranscription.js";
import { isLanguageInSelectedPair } from "./languageContainment.js";

/** @typedef {"empty" | "tooShort" | "duplicate" | "responding" | "uncertain" | "languageMismatch" | "suppressed" | "noise" | "no_dc" | "dc_not_open" | "paused" | "scope_paused" | "target_language_not_in_pair"} TranscriptSkipReason */

/**
 * Extract no_speech / quality hints from Realtime events when present.
 * @param {Record<string, unknown>} event
 */
export function extractTranscriptionQualityHints(event) {
  if (!event || typeof event !== "object") {
    return { confidence: null, noSpeech: null, quality: null };
  }

  const confidence = extractTranscriptionConfidence(event);

  let noSpeech = null;
  if (typeof event.no_speech === "boolean") noSpeech = event.no_speech;
  const transcription = event.transcription;
  if (transcription && typeof transcription === "object") {
    const t = /** @type {{ no_speech?: boolean; quality?: string }} */ (transcription);
    if (typeof t.no_speech === "boolean") noSpeech = t.no_speech;
  }

  let quality = null;
  if (typeof event.quality === "string") quality = event.quality;
  if (transcription && typeof transcription === "object") {
    const q = /** @type {{ quality?: string }} */ (transcription).quality;
    if (typeof q === "string") quality = q;
  }

  return { confidence, noSpeech, quality };
}

/**
 * Dev-only: log every Realtime event relevant to transcript / response pipeline.
 * @param {Record<string, unknown>} event
 */
export function logRealtimeTranscriptEvent(event) {
  if (!import.meta.env?.DEV) return;
  if (!event || typeof event !== "object") return;

  const type = typeof event.type === "string" ? event.type : "unknown";
  const inputText = extractOriginalText(event);
  const outputText =
    extractTranslatedText(event) || extractTranslatedTextFromResponse(event);
  const { confidence, noSpeech, quality } = extractTranscriptionQualityHints(event);

  const textPreview = (inputText || outputText || "").slice(0, 160) || null;

  console.info("[MedaTranscriptGate]", {
    eventType: type,
    textPreview,
    textLength: (inputText || outputText || "").length,
    confidence,
    noSpeech,
    quality,
    isInputCompleted:
      type === "conversation.item.input_audio_transcription.completed" ||
      type === "input_audio_transcription.completed" ||
      type === "input_audio_buffer.transcription.completed",
    isResponseDone:
      type === "response.done" ||
      type === "response.audio_transcript.done" ||
      type === "response.output_audio_transcript.done" ||
      type === "response.text.done" ||
      type === "response.output_text.done",
  });
}

/**
 * Resolve final transcript from completed event + optional delta accumulation.
 * @param {Record<string, unknown>} event
 * @param {string} [accumulatedFromDeltas]
 */
export function resolveFinalInputTranscript(event, accumulatedFromDeltas = "") {
  const extracted = extractOriginalText(event).trim();
  const accumulated = String(accumulatedFromDeltas || "").trim();
  if (extracted && accumulated && extracted !== accumulated) {
    return extracted.length >= accumulated.length ? extracted : accumulated;
  }
  return extracted || accumulated;
}

/**
 * @param {{
 *   rawTranscript: string;
 *   inputState?: "pending" | "ready" | "empty" | "failed";
 *   scopeTranslationPaused?: boolean;
 *   responseActive?: boolean;
 *   lastResponseCreateKey?: string;
 *   detectedLanguage?: string | null;
 *   activeSpeaker?: string;
 *   sourceLanguage?: string;
 *   transcriptionLanguageAuto?: boolean;
 *   languageRoutingEnabled?: boolean;
 *   patientLanguage?: string;
 *   doctorLanguage?: string;
 *   noSpeech?: boolean | null;
 *   phase?: "completed" | "request_translation";
 * }} input
 * @returns {{ proceed: boolean; skipReason: TranscriptSkipReason | null; normalizedTranscript: string; transcriptLength: number }}
 */
export function evaluateTranscriptGate(input) {
  const raw = String(input.rawTranscript || "");
  const normalizedTranscript = raw.trim();
  const normalizedKey = normalizeTranscriptKey(normalizedTranscript);
  const transcriptLength = normalizedTranscript.length;
  const isDev = import.meta.env?.DEV;

  const logGate = (skipReason, extra = {}) => {
    if (!import.meta.env?.DEV) return;
    console.info("[MedaTranscriptGate]", {
      phase: input.phase ?? "gate",
      rawTranscript: normalizedTranscript.slice(0, 200),
      normalizedTranscript: normalizedTranscript.slice(0, 200),
      transcriptLength,
      detectedLanguage: input.detectedLanguage ?? null,
      activeSpeaker: input.activeSpeaker ?? null,
      sourceLanguage: input.sourceLanguage ?? null,
      inputState: input.inputState ?? null,
      noSpeech: input.noSpeech ?? null,
      skipReason,
      ...extra,
    });
  };

  if (input.responseActive) {
    logGate("responding");
    return { proceed: false, skipReason: "responding", normalizedTranscript, transcriptLength };
  }

  if (!normalizedTranscript || isLikelyEmptyOrNoiseTranscript(normalizedTranscript)) {
    if (isDev && normalizedTranscript && isLikelyEmptyOrNoiseTranscript(normalizedTranscript)) {
      logGate("noise");
      return { proceed: false, skipReason: "noise", normalizedTranscript, transcriptLength };
    }
    logGate("empty");
    return { proceed: false, skipReason: "empty", normalizedTranscript, transcriptLength };
  }

  const minChars = isDev ? 3 : MIN_STABLE_TRANSCRIPT_CHARS;
  if (transcriptLength < minChars) {
    logGate("tooShort", { minChars });
    return { proceed: false, skipReason: "tooShort", normalizedTranscript, transcriptLength };
  }

  if (
    normalizedKey &&
    input.lastResponseCreateKey &&
    normalizedKey === input.lastResponseCreateKey
  ) {
    logGate("duplicate");
    return { proceed: false, skipReason: "duplicate", normalizedTranscript, transcriptLength };
  }

  if (input.scopeTranslationPaused) {
    logGate("suppressed", { detail: "scope_paused" });
    return { proceed: false, skipReason: "scope_paused", normalizedTranscript, transcriptLength };
  }

  const uncertainByState =
    input.inputState !== "ready" && input.inputState !== undefined;

  const uncertainByNoSpeech = input.noSpeech === true;

  if (isDev) {
    if (uncertainByNoSpeech) {
      logGate("uncertain", { detail: "no_speech_true" });
      return { proceed: false, skipReason: "uncertain", normalizedTranscript, transcriptLength };
    }
    if (uncertainByState && !normalizedTranscript) {
      logGate("uncertain", { detail: "input_state_not_ready" });
      return { proceed: false, skipReason: "uncertain", normalizedTranscript, transcriptLength };
    }
  } else if (
    !canProceedToTranslation({
      transcript: normalizedTranscript,
      inputState: input.inputState ?? "pending",
      scopeTranslationPaused: Boolean(input.scopeTranslationPaused),
    })
  ) {
    logGate("uncertain", { detail: "canProceedToTranslation_false" });
    return { proceed: false, skipReason: "uncertain", normalizedTranscript, transcriptLength };
  }

  if (
    input.languageRoutingEnabled &&
    !input.transcriptionLanguageAuto &&
    input.detectedLanguage &&
    input.patientLanguage &&
    input.doctorLanguage
  ) {
    if (
      !isLanguageInSelectedPair(
        input.detectedLanguage,
        input.patientLanguage,
        input.doctorLanguage,
      )
    ) {
      logGate("languageMismatch");
      return { proceed: false, skipReason: "languageMismatch", normalizedTranscript, transcriptLength };
    }
  }

  logGate(null, { proceed: true });
  return { proceed: true, skipReason: null, normalizedTranscript, transcriptLength };
}
