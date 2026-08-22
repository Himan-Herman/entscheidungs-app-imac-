/**
 * OpenAI-compatible dictation adapter.
 *
 * Uses its own credential and endpoint from the dictation configuration — not
 * the shared client, not the translation keys. See messageSttProviderConfig.js
 * for why that separation is the point.
 *
 * Transcription only. No translation mode, no summarisation, no "improved"
 * output: the service is asked for what was said, and anything else it might
 * offer is refused by the validator rather than displayed.
 */

import { MESSAGE_STT_ERRORS, MessageSttError } from "../messageSttPolicy.js";
import { STT_PROVIDER_TIMEOUT_MS } from "./messageSttProviderConfig.js";

/** File extension a provider expects for each container. */
const EXTENSION = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/**
 * @param {import("./messageSttProviderConfig.js").SttProviderConfig} config
 * @param {{ fetchImpl?: Function }} [deps]
 */
export function createOpenAiMessageSttProvider(config, deps = {}) {
  if (!config?.configured) {
    throw new MessageSttError(MESSAGE_STT_ERRORS.PROVIDER_NOT_CONFIGURED, {
      reason: "adapter_constructed_without_config",
    });
  }
  const doFetch = deps.fetchImpl ?? fetch;

  /**
   * @param {{ audio: Buffer, mimeType: string, language: string | null, signal?: AbortSignal }} request
   */
  async function transcribe(request) {
    const form = new FormData();
    form.append("model", config.model);
    // Transcription, never the translate endpoint: that one silently renders
    // everything into English, which would be a different feature and a
    // different promise.
    form.append("response_format", "json");
    if (request.language) form.append("language", request.language);
    form.append(
      "file",
      new Blob([request.audio], { type: request.mimeType }),
      `dictation.${EXTENSION[request.mimeType] ?? "webm"}`,
    );

    // A timeout of its own, so a service that never answers cannot hold a
    // request — and the recording — open indefinitely.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STT_PROVIDER_TIMEOUT_MS);
    request.signal?.addEventListener("abort", () => controller.abort(), { once: true });

    let res;
    try {
      res = await doFetch(`${config.baseUrl.replace(/\/+$/, "")}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      throw mapProviderError(err);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // The body is not read: a provider error message can echo the request,
      // and this one's request is a recording.
      throw new MessageSttError(MESSAGE_STT_ERRORS.PROVIDER_FAILED, { status: res.status });
    }
    return res.json().catch(() => {
      throw new MessageSttError(MESSAGE_STT_ERRORS.PROVIDER_FAILED, { reason: "unparseable" });
    });
  }

  return { kind: "openai", model: config.model, transcribe };
}

/** @param {unknown} err */
function mapProviderError(err) {
  if (err instanceof MessageSttError) return err;
  const aborted = err?.name === "AbortError";
  return new MessageSttError(MESSAGE_STT_ERRORS.PROVIDER_FAILED, {
    ...(aborted ? { reason: "timeout" } : {}),
  });
}
