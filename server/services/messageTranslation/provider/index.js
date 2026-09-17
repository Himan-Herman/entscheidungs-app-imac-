/**
 * Picks the adapter, or refuses to pick one.
 *
 * There is no default and no fallback. A deployment that has not stated where
 * message text may go has nowhere for it to go, and this returns an error
 * rather than a working provider.
 */

import {
  MESSAGE_TRANSLATION_ERRORS,
  MessageTranslationError,
} from "../messageTranslationPolicy.js";
import {
  MESSAGE_PROVIDER_KINDS,
  resolveMessageProviderConfig,
} from "./messageTranslationProviderConfig.js";
import { createFakeMessageTranslationProvider } from "./fakeMessageTranslationProvider.js";
import { createOpenAiMessageTranslationProvider } from "./openAiMessageTranslationProvider.js";

/**
 * @param {{ env?: NodeJS.ProcessEnv, fakeOptions?: object }} [options]
 */
export function resolveMessageTranslationProvider(options = {}) {
  const config = resolveMessageProviderConfig(options.env ?? process.env);

  if (!config.configured) {
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED, {
      // Which variables are absent is operational metadata, not content, and it
      // is what an operator needs in order to fix the deployment.
      missing: config.missing,
      reason: config.reason,
    });
  }

  if (config.kind === MESSAGE_PROVIDER_KINDS.FAKE) {
    return createFakeMessageTranslationProvider({
      ...(config.fakeBehaviour ? { behaviour: config.fakeBehaviour } : {}),
      ...options.fakeOptions,
    });
  }

  return createOpenAiMessageTranslationProvider(config);
}

export { resolveMessageProviderConfig };
