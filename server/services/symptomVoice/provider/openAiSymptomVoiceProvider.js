/**
 * OpenAI-compatible adapter for symptom voice input.
 *
 * Uses the credential and endpoint from THIS feature's configuration. It does
 * not import the shared client and does not read OPENAI_API_KEY — that
 * inheritance is the finding this phase closes.
 */

import { SYMPTOM_VOICE_ERRORS, SymptomVoiceError } from "../symptomVoicePolicy.js";
import { SYMPTOM_VOICE_TIMEOUT_MS } from "./symptomVoiceProviderConfig.js";

const EXTENSION = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/**
 * @param {object} config
 * @param {{ fetchImpl?: Function }} [deps]
 */
export function createOpenAiSymptomVoiceProvider(config, deps = {}) {
  if (!config?.configured) {
    throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.PROVIDER_NOT_CONFIGURED, {
      reason: "adapter_constructed_without_config",
    });
  }
  const doFetch = deps.fetchImpl ?? fetch;

  async function transcribe(request) {
    const form = new FormData();
    form.append("model", config.model);
    // Transcription, never the translate endpoint — that one renders
    // everything into English, which is a different feature.
    form.append("response_format", "json");
    form.append(
      "file",
      new Blob([request.audio], { type: request.mimeType }),
      `voice.${EXTENSION[request.mimeType] ?? "webm"}`,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SYMPTOM_VOICE_TIMEOUT_MS);

    let res;
    try {
      res = await doFetch(`${config.baseUrl.replace(/\/+$/, "")}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      throw err instanceof SymptomVoiceError
        ? err
        : new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.PROVIDER_FAILED, {
            ...(err?.name === "AbortError" ? { reason: "timeout" } : {}),
          });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // The body is not read: a provider's error text can echo the request, and
      // this request is a recording of someone describing their symptoms.
      throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.PROVIDER_FAILED, { status: res.status });
    }
    return res.json().catch(() => {
      throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.PROVIDER_FAILED, { reason: "unparseable" });
    });
  }

  return { kind: "openai", model: config.model, transcribe };
}
