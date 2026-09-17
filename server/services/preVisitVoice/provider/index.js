/**
 * Picks the adapter, or refuses to pick one.
 *
 * No default and no fallback — in particular no fallback to the shared
 * OPENAI_API_KEY, which is what this path used to do.
 */

import { PREVISIT_VOICE_ERRORS, PreVisitVoiceError } from "../preVisitVoicePolicy.js";
import {
  PREVISIT_VOICE_KINDS,
  resolvePreVisitVoiceConfig,
} from "./preVisitVoiceProviderConfig.js";
import { createFakePreVisitVoiceProvider } from "./fakePreVisitVoiceProvider.js";
import { createOpenAiPreVisitVoiceProvider } from "./openAiPreVisitVoiceProvider.js";

/** @param {{ env?: NodeJS.ProcessEnv, fakeOptions?: object }} [options] */
export function resolvePreVisitVoiceProvider(options = {}) {
  const config = resolvePreVisitVoiceConfig(options.env ?? process.env);

  if (!config.configured) {
    throw new PreVisitVoiceError(PREVISIT_VOICE_ERRORS.PROVIDER_NOT_CONFIGURED, {
      missing: config.missing,
      reason: config.reason,
    });
  }

  if (config.kind === PREVISIT_VOICE_KINDS.FAKE) {
    return createFakePreVisitVoiceProvider({
      ...(config.fakeBehaviour ? { behaviour: config.fakeBehaviour } : {}),
      ...options.fakeOptions,
    });
  }

  return createOpenAiPreVisitVoiceProvider(config);
}

export { resolvePreVisitVoiceConfig };
