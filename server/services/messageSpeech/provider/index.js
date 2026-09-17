/**
 * Picks the dictation adapter, or refuses to pick one.
 *
 * No default and no fallback. A deployment that has not stated where a
 * recording may go has nowhere to send one.
 */

import { MESSAGE_STT_ERRORS, MessageSttError } from "../messageSttPolicy.js";
import {
  STT_PROVIDER_KINDS,
  resolveSttProviderConfig,
} from "./messageSttProviderConfig.js";
import { createFakeMessageSttProvider } from "./fakeMessageSttProvider.js";
import { createOpenAiMessageSttProvider } from "./openAiMessageSttProvider.js";

/** @param {{ env?: NodeJS.ProcessEnv, fakeOptions?: object }} [options] */
export function resolveMessageSttProvider(options = {}) {
  const config = resolveSttProviderConfig(options.env ?? process.env);

  if (!config.configured) {
    throw new MessageSttError(MESSAGE_STT_ERRORS.PROVIDER_NOT_CONFIGURED, {
      missing: config.missing,
      reason: config.reason,
    });
  }

  if (config.kind === STT_PROVIDER_KINDS.FAKE) {
    return createFakeMessageSttProvider({
      ...(config.fakeBehaviour ? { behaviour: config.fakeBehaviour } : {}),
      ...options.fakeOptions,
    });
  }

  return createOpenAiMessageSttProvider(config);
}

export { resolveSttProviderConfig };
