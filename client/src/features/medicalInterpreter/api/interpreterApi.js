import { authFetch } from "../../../api/authFetch.js";
import { INTERPRETER_TRANSCRIBE_TIMEOUT_MS } from "../utils/interpreterAudioConstants.js";
import { createRequestAbortSignal } from "../utils/interpreterAudioSignals.js";
import { INTERPRETER_JSON_REQUEST_TIMEOUT_MS } from "../utils/interpreterReliabilityConstants.js";

/**
 * @typedef {'module_disabled'|'tts_disabled'|'unauthorized'|'rate_limited'|'network'|'transcribe_failed'|'transcribe_timeout'|'translate_failed'|'translate_timeout'|'simplify_failed'|'simplify_timeout'|'speak_failed'|'speak_unsupported'|'blocked'|'validation'|'cancelled'|'generic'} InterpreterApiErrorCode
 */

/**
 * @param {Response} res
 * @param {object} data
 * @returns {InterpreterApiErrorCode}
 */
function classifyHttpError(res, data) {
  if (res.status === 401) return "unauthorized";
  if (res.status === 429 || data?.error === "rate_limited") return "rate_limited";
  if (res.status === 503 && data?.error === "medical_interpreter_disabled") {
    return "module_disabled";
  }
  if (res.status === 503 && data?.error === "interpreter_tts_disabled") {
    return "tts_disabled";
  }
  if (data?.error === "validation_blocked" || data?.error === "unsafe_medical_content") {
    return "blocked";
  }
  if (res.status === 400) return "validation";
  return "generic";
}

/**
 * @param {unknown} err
 * @returns {InterpreterApiErrorCode}
 */
function classifyFetchError(err) {
  if (err?.message === "SESSION_EXPIRED") return "unauthorized";
  return "network";
}

/**
 * @param {InterpreterApiErrorCode} code
 * @param {object} labels — medicalInterpreter i18n slice
 * @param {string} [serverMessage] — safe server message (blocked translation only)
 */
export function interpreterErrorMessage(code, labels, serverMessage) {
  const t = labels?.errors ?? {};
  switch (code) {
    case "module_disabled":
      return t.moduleDisabled || labels?.empty?.moduleDisabled;
    case "unauthorized":
      return t.unauthorized;
    case "rate_limited":
      return t.rateLimited;
    case "transcribe_failed":
      return t.transcribeFailed;
    case "transcribe_timeout":
      return t.transcribeTimeout;
    case "translate_timeout":
    case "simplify_timeout":
      return t.requestTimeout;
    case "speak_unsupported":
      return t.speakUnsupported;
    case "translate_failed":
      return t.translateFailed;
    case "simplify_failed":
      return t.simplifyFailed;
    case "speak_failed":
      return t.speakFailed;
    case "tts_disabled":
      return t.ttsDisabled;
    case "blocked":
      return serverMessage || labels?.translation?.blocked;
    case "validation":
      return t.textTooLong || t.transcribeFailed || t.generic;
    case "network":
      return t.network;
    default:
      return t.generic;
  }
}

/**
 * @param {Blob} audioBlob
 * @param {{ language?: string, filename?: string }} [metadata]
 * @returns {Promise<
 *   | { ok: true, transcript: string, language?: string, confidence?: string }
 *   | { ok: false, code: InterpreterApiErrorCode, message?: string }
 * >}
 */
/**
 * @returns {Promise<
 *   | { ok: true, enabled: boolean, ttsEnabled: boolean }
 *   | { ok: false, code: InterpreterApiErrorCode }
 * >}
 */
export async function fetchInterpreterStatus() {
  try {
    const res = await authFetch("/api/interpreter/status");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, code: classifyHttpError(res, data) };
    }
    return {
      ok: true,
      enabled: data.enabled === true,
      ttsEnabled: data.ttsEnabled === true,
      cloudEnabled: data.cloudEnabled === true,
      cloudAvailable: data.cloudAvailable === true,
      encryptionReady: data.encryptionReady === true,
      streamingSttEnabled: data.streamingSttEnabled === true,
      nearRealtimeTranslationEnabled:
        data.nearRealtimeTranslationEnabled === true,
      streamingTtsEnabled: data.streamingTtsEnabled === true,
    };
  } catch (err) {
    return { ok: false, code: classifyFetchError(err) };
  }
}

export async function transcribeAudio(audioBlob, metadata = {}) {
  const formData = new FormData();
  const filename =
    metadata.filename ||
    (audioBlob.type?.includes("ogg") ? "recording.ogg" : "recording.webm");
  formData.append("audio", audioBlob, filename);
  if (metadata.language) {
    formData.append("language", metadata.language);
  }

  const userAborted = () => metadata.signal?.aborted === true;
  const { signal, cleanup } = createRequestAbortSignal(
    metadata.signal,
    metadata.timeoutMs ?? INTERPRETER_TRANSCRIBE_TIMEOUT_MS,
  );

  try {
    const res = await authFetch("/api/interpreter/transcribe", {
      method: "POST",
      body: formData,
      signal,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      const code =
        data.error === "validation_file_too_large"
          ? "validation"
          : data.error === "validation_audio_too_short"
            ? "validation"
            : data.error === "transcription_failed"
              ? "transcribe_failed"
              : classifyHttpError(res, data);
      return { ok: false, code, message: data.message };
    }

    return {
      ok: true,
      transcript: typeof data.transcript === "string" ? data.transcript : "",
      language: data.language,
      confidence: data.confidence,
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      if (userAborted()) return { ok: false, code: "cancelled" };
      return { ok: false, code: "transcribe_timeout" };
    }
    return { ok: false, code: classifyFetchError(err) };
  } finally {
    cleanup();
  }
}

/**
 * @param {{ text: string, sourceLanguage: string, targetLanguage: string, speaker: 'patient'|'doctor' }} params
 * @returns {Promise<
 *   | { ok: true, translatedText: string, sourceLanguage: string, targetLanguage: string, translationDirection?: string, confidence?: string, uncertain?: boolean, terminologyWarning?: boolean, unclearSource?: boolean }
 *   | { ok: false, code: InterpreterApiErrorCode, message?: string }
 * >}
 */
export async function translateTurn(params, options = {}) {
  const userAborted = () => options.signal?.aborted === true;
  const { signal, cleanup } = createRequestAbortSignal(
    options.signal,
    options.timeoutMs ?? INTERPRETER_JSON_REQUEST_TIMEOUT_MS,
  );

  try {
    const res = await authFetch("/api/interpreter/translate", {
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
        code: "blocked",
        message: data.message,
      };
    }

    if (!res.ok || data.ok === false) {
      const code =
        data.error === "translation_failed"
          ? "translate_failed"
          : classifyHttpError(res, data);
      return { ok: false, code, message: data.message };
    }

    return {
      ok: true,
      translatedText: data.translatedText ?? "",
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      translationDirection: data.translationDirection,
      confidence: data.confidence,
      uncertain: data.uncertain === true,
      terminologyWarning: data.terminologyWarning === true,
      unclearSource: data.unclearSource === true,
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      if (userAborted()) return { ok: false, code: "cancelled" };
      return { ok: false, code: "translate_timeout" };
    }
    return { ok: false, code: classifyFetchError(err) };
  } finally {
    cleanup();
  }
}

/**
 * @param {{ text: string, language: string, speaker: 'patient'|'doctor' }} params
 * @returns {Promise<
 *   | { ok: true, simplifiedText: string, language: string, confidence?: string, safety?: object }
 *   | { ok: false, code: InterpreterApiErrorCode, message?: string }
 * >}
 */
export async function simplifyTurn(params, options = {}) {
  const userAborted = () => options.signal?.aborted === true;
  const { signal, cleanup } = createRequestAbortSignal(
    options.signal,
    options.timeoutMs ?? INTERPRETER_JSON_REQUEST_TIMEOUT_MS,
  );

  try {
    const res = await authFetch("/api/interpreter/simplify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: params.text,
        language: params.language,
        speaker: params.speaker,
      }),
      signal,
    });
    const data = await res.json().catch(() => ({}));

    if (data.error === "unsafe_medical_content") {
      return {
        ok: false,
        code: "blocked",
        message: data.message,
      };
    }

    if (!res.ok || data.ok === false) {
      const code =
        data.error === "simplification_failed"
          ? "simplify_failed"
          : classifyHttpError(res, data);
      return { ok: false, code, message: data.message };
    }

    return {
      ok: true,
      simplifiedText: data.simplifiedText ?? "",
      language: data.language,
      confidence: data.confidence,
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      if (userAborted()) return { ok: false, code: "cancelled" };
      return { ok: false, code: "simplify_timeout" };
    }
    return { ok: false, code: classifyFetchError(err) };
  } finally {
    cleanup();
  }
}

/**
 * @param {{ text: string, language: string, voicePreference?: string, voiceSpeed?: string }} params
 * @returns {Promise<
 *   | { ok: true, blob: Blob, contentType: string }
 *   | { ok: false, code: InterpreterApiErrorCode, message?: string }
 * >}
 */
export async function speakText(params, options = {}) {
  try {
    const res = await authFetch("/api/interpreter/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: params.text,
        language: params.language,
        voicePreference: params.voicePreference ?? "neutral_medical",
        voiceSpeed: params.voiceSpeed ?? "normal",
      }),
      signal: options.signal,
    });

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => ({}));
      const code =
        data.error === "speech_failed"
          ? "speak_failed"
          : classifyHttpError(res, data);
      return { ok: false, code, message: data.message };
    }

    if (!res.ok) {
      return { ok: false, code: "speak_failed" };
    }

    const blob = await res.blob();
    return {
      ok: true,
      blob,
      contentType: contentType || "audio/mpeg",
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { ok: false, code: "cancelled" };
    }
    return { ok: false, code: classifyFetchError(err) };
  }
}
