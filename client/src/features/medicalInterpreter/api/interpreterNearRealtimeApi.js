import { authFetch } from "../../../api/authFetch.js";
import { INTERPRETER_JSON_REQUEST_TIMEOUT_MS } from "../utils/interpreterReliabilityConstants.js";
import { createRequestAbortSignal } from "../utils/interpreterAudioSignals.js";

/**
 * Stateless preview translate — no conversation history.
 *
 * @param {{ text: string, sourceLanguage: string, targetLanguage: string, speaker: 'patient'|'doctor' }} params
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function translateNearRealtimePreview(params, options = {}) {
  const userAborted = () => options.signal?.aborted === true;
  const { signal, cleanup } = createRequestAbortSignal(
    options.signal,
    INTERPRETER_JSON_REQUEST_TIMEOUT_MS,
  );

  try {
    const res = await authFetch("/api/interpreter/near-realtime/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: params.text,
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
        speaker: params.speaker,
      }),
      signal,
    });
    const data = await res.json().catch(() => ({}));

    if (data.error === "unsafe_medical_content") {
      return {
        ok: false,
        error: "unsafe_medical_content",
        message: data.message,
      };
    }

    if (res.status === 503 && data.error === "interpreter_near_realtime_disabled") {
      return { ok: false, error: "feature_disabled" };
    }

    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: data.error || "translation_failed",
        message: data.message,
      };
    }

    return {
      ok: true,
      translatedText: data.translatedText ?? "",
      uncertain: data.uncertain === true,
      terminologyWarning: data.terminologyWarning === true,
      unclearSource: data.unclearSource === true,
      confidence: data.confidence,
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      if (userAborted()) return { ok: false, error: "cancelled" };
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "network" };
  } finally {
    cleanup();
  }
}
