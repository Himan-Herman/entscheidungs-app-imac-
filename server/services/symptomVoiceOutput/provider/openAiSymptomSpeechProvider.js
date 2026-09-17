/**
 * OpenAI-compatible synthesis adapter for symptom read-aloud.
 *
 * Uses the credential and endpoint from THIS feature's configuration. It does
 * not import the shared client and does not read OPENAI_API_KEY — that
 * inheritance is the finding this phase closes.
 */

import {
  SPEECH_OUTPUT_FORMAT,
  looksLikeSpeechAudio,
} from "../../speechOutput/speechAudioFormat.js";
import { SYMPTOM_SPEECH_ERRORS, SymptomSpeechError } from "../symptomVoiceOutputPolicy.js";
import { SYMPTOM_SPEECH_TIMEOUT_MS } from "./symptomVoiceOutputProviderConfig.js";

/**
 * @param {object} config
 * @param {{ fetchImpl?: Function }} [deps]
 */
export function createOpenAiSymptomSpeechProvider(config, deps = {}) {
  if (!config?.configured) {
    throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.PROVIDER_NOT_CONFIGURED, {
      reason: "adapter_constructed_without_config",
    });
  }
  const doFetch = deps.fetchImpl ?? fetch;

  /** @param {{ text: string }} request */
  async function synthesize(request) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SYMPTOM_SPEECH_TIMEOUT_MS);

    let res;
    try {
      res = await doFetch(`${config.baseUrl.replace(/\/+$/, "")}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        // The whole payload. The text to be spoken, the model, the voice the
        // operator configured, and the format we will label the response with —
        // no session, no account, no conversation around it.
        body: JSON.stringify({
          model: config.model,
          voice: config.voice,
          input: request.text,
          response_format: SPEECH_OUTPUT_FORMAT,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw err instanceof SymptomSpeechError
        ? err
        : new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.PROVIDER_FAILED, {
            ...(err?.name === "AbortError" ? { reason: "timeout" } : {}),
          });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // The body is not read: a provider's error text can echo the request, and
      // the request is what a patient was told about their symptoms.
      throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.PROVIDER_FAILED, { status: res.status });
    }

    const audio = Buffer.from(await res.arrayBuffer());
    // What came back is checked before it is handed to a patient's audio
    // element — an error page served with a 200 is not speech.
    if (!looksLikeSpeechAudio(audio)) {
      throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.AUDIO_MALFORMED, { bytes: audio.length });
    }
    return { audio };
  }

  return { kind: "openai", model: config.model, synthesize };
}
