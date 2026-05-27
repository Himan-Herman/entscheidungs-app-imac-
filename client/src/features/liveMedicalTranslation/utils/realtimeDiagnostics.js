import { extractOriginalText, extractTranslatedText, extractTranslatedTextFromResponse } from "./webrtc.js";

/**
 * Realtime connection lifecycle logs (browser console). No transcripts, secrets, or SDP bodies.
 * @param {string} event
 * @param {Record<string, unknown>} [detail]
 */
export function logRealtimeConnect(event, detail = {}) {
  const payload = { event, ...detail };
  console.info("[MedaRealtimeConnect]", payload);
  if (import.meta.env?.DEV) {
    console.debug("[live-translation-rt]", event, detail);
  }
}

/**
 * Dev-only Realtime lifecycle diagnostics. Never logs transcript, audio, tokens, or patient data.
 * @param {string} scope
 * @param {Record<string, unknown>} [detail]
 */
export function logRealtimeDiag(scope, detail = {}) {
  if (!import.meta.env?.DEV) return;
  const safe = { ...detail };
  delete safe.instructions;
  delete safe.transcript;
  delete safe.delta;
  delete safe.text;
  console.info("[live-translation-rt]", scope, safe);
}

/** @param {unknown} event */
export function summarizeRealtimeEvent(event) {
  if (!event || typeof event !== "object") return { type: "unknown" };
  const e = /** @type {Record<string, unknown>} */ (event);
  const err = e.error && typeof e.error === "object" ? /** @type {Record<string, unknown>} */ (e.error) : null;
  return {
    type: typeof e.type === "string" ? e.type : null,
    errorType: err && typeof err.type === "string" ? err.type : null,
    errorCode: err && typeof err.code === "string" ? err.code : null,
    errorMessage: err && typeof err.message === "string" ? err.message.slice(0, 120) : null,
    responseStatus:
      e.response && typeof e.response === "object" && "status" in e.response
        ? String(/** @type {{ status?: unknown }} */ (e.response).status)
        : null,
  };
}

/** Safe pipeline summary — event type + lengths only, no transcript text. */
export function summarizePipelineEvent(event) {
  const base = summarizeRealtimeEvent(event);
  if (!event || typeof event !== "object") return base;
  const e = /** @type {Record<string, unknown>} */ (event);
  const original = extractOriginalText(e);
  const translated =
    extractTranslatedText(e) || extractTranslatedTextFromResponse(e);
  const hasResponse = Boolean(e.response && typeof e.response === "object");
  return {
    ...base,
    hasTranscript: original.length > 0,
    transcriptLength: original.length,
    hasTranslation: translated.length > 0,
    translationLength: translated.length,
    hasResponse,
  };
}
