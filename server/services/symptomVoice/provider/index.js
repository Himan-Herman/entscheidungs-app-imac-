/**
 * Picks the adapter, or refuses to pick one.
 *
 * No default and no fallback — in particular no fallback to the shared
 * OPENAI_API_KEY, which is what this path used to do.
 */

import { SYMPTOM_VOICE_ERRORS, SymptomVoiceError } from "../symptomVoicePolicy.js";
import {
  SYMPTOM_VOICE_KINDS,
  resolveSymptomVoiceConfig,
} from "./symptomVoiceProviderConfig.js";
import { createFakeSymptomVoiceProvider } from "./fakeSymptomVoiceProvider.js";
import { createOpenAiSymptomVoiceProvider } from "./openAiSymptomVoiceProvider.js";

/** @param {{ env?: NodeJS.ProcessEnv, fakeOptions?: object }} [options] */
export function resolveSymptomVoiceProvider(options = {}) {
  const config = resolveSymptomVoiceConfig(options.env ?? process.env);

  if (!config.configured) {
    throw new SymptomVoiceError(SYMPTOM_VOICE_ERRORS.PROVIDER_NOT_CONFIGURED, {
      missing: config.missing,
      reason: config.reason,
    });
  }

  if (config.kind === SYMPTOM_VOICE_KINDS.FAKE) {
    return createFakeSymptomVoiceProvider({
      ...(config.fakeBehaviour ? { behaviour: config.fakeBehaviour } : {}),
      ...options.fakeOptions,
    });
  }

  return createOpenAiSymptomVoiceProvider(config);
}

export { resolveSymptomVoiceConfig };
