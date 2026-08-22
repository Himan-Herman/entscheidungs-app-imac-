/**
 * Picks the adapter, or refuses to pick one.
 *
 * No default and no fallback — in particular no fallback to the shared
 * OPENAI_API_KEY, which is what this path used to do.
 */

import { SYMPTOM_SPEECH_ERRORS, SymptomSpeechError } from "../symptomVoiceOutputPolicy.js";
import {
  SYMPTOM_SPEECH_KINDS,
  resolveSymptomSpeechConfig,
} from "./symptomVoiceOutputProviderConfig.js";
import { createFakeSymptomSpeechProvider } from "./fakeSymptomSpeechProvider.js";
import { createOpenAiSymptomSpeechProvider } from "./openAiSymptomSpeechProvider.js";

/** @param {{ env?: NodeJS.ProcessEnv, fakeOptions?: object }} [options] */
export function resolveSymptomSpeechProvider(options = {}) {
  const config = resolveSymptomSpeechConfig(options.env ?? process.env);

  if (!config.configured) {
    throw new SymptomSpeechError(SYMPTOM_SPEECH_ERRORS.PROVIDER_NOT_CONFIGURED, {
      missing: config.missing,
      reason: config.reason,
    });
  }

  if (config.kind === SYMPTOM_SPEECH_KINDS.FAKE) {
    return createFakeSymptomSpeechProvider({
      ...(config.fakeBehaviour ? { behaviour: config.fakeBehaviour } : {}),
      ...options.fakeOptions,
    });
  }

  return createOpenAiSymptomSpeechProvider(config);
}

export { resolveSymptomSpeechConfig };
