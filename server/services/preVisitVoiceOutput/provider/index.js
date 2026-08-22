/**
 * Picks the adapter, or refuses to pick one.
 *
 * No default and no fallback — in particular no fallback to the shared
 * OPENAI_API_KEY, which is what this path used to do.
 */

import { PREVISIT_SPEECH_ERRORS, PreVisitSpeechError } from "../preVisitVoiceOutputPolicy.js";
import {
  PREVISIT_SPEECH_KINDS,
  resolvePreVisitSpeechConfig,
} from "./preVisitVoiceOutputProviderConfig.js";
import { createFakePreVisitSpeechProvider } from "./fakePreVisitSpeechProvider.js";
import { createOpenAiPreVisitSpeechProvider } from "./openAiPreVisitSpeechProvider.js";

/** @param {{ env?: NodeJS.ProcessEnv, fakeOptions?: object }} [options] */
export function resolvePreVisitSpeechProvider(options = {}) {
  const config = resolvePreVisitSpeechConfig(options.env ?? process.env);

  if (!config.configured) {
    throw new PreVisitSpeechError(PREVISIT_SPEECH_ERRORS.PROVIDER_NOT_CONFIGURED, {
      missing: config.missing,
      reason: config.reason,
    });
  }

  if (config.kind === PREVISIT_SPEECH_KINDS.FAKE) {
    return createFakePreVisitSpeechProvider({
      ...(config.fakeBehaviour ? { behaviour: config.fakeBehaviour } : {}),
      ...options.fakeOptions,
    });
  }

  return createOpenAiPreVisitSpeechProvider(config);
}

export { resolvePreVisitSpeechConfig };
