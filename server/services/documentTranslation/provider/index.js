/**
 * Provider resolution — the single place an adapter is chosen.
 *
 * The rest of the translation service depends on this interface, never on a
 * vendor SDK, so a provider can be replaced without touching provenance,
 * masking, integrity checking, the route or the UI.
 *
 * Interface:
 *   translatePreparedSegments({ sourceLanguage, targetLanguage, mode,
 *                               segments, repair?, signal? })
 *     -> { raw: string, model: string }
 *
 * `raw` is an unparsed body on purpose: parsing and schema validation belong to
 * documentTranslationOutputValidation.js, so every provider is held to the same
 * check rather than each adapter deciding what "valid" means.
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "../documentTranslationPolicy.js";
import {
  PROVIDER_KINDS,
  resolveProviderConfig,
} from "./documentTranslationProviderConfig.js";
import { createFakeDocumentTranslationProvider } from "./fakeDocumentTranslationProvider.js";
import { createOpenAiDocumentTranslationProvider } from "./openAiDocumentTranslationProvider.js";

export { resolveProviderConfig, describeProviderConfig } from "./documentTranslationProviderConfig.js";

/**
 * Resolve the configured provider, or refuse.
 *
 * This is the release gate for external processing: with no translation
 * specific configuration present, it throws and not one character of document
 * content leaves the server.
 *
 * @param {{ env?: NodeJS.ProcessEnv, fakeOptions?: object }} [options]
 * @returns {{ kind: string, translatePreparedSegments: Function }}
 * @throws {DocumentTranslationError} document_translation_provider_not_configured
 */
export function resolveDocumentTranslationProvider(options = {}) {
  const config = resolveProviderConfig(options.env ?? process.env);

  if (!config.configured) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED, {
      // Which variables are absent is operational metadata, not content, and it
      // is what an operator needs to fix the deployment.
      missing: config.missing,
      reason: config.reason,
    });
  }

  if (config.kind === PROVIDER_KINDS.FAKE) {
    return createFakeDocumentTranslationProvider({
      ...(config.fakeBehaviour ? { behaviour: config.fakeBehaviour } : {}),
      ...options.fakeOptions,
    });
  }

  return createOpenAiDocumentTranslationProvider(config);
}

/**
 * Whether external processing is currently possible at all.
 * Used by the service to fail fast, and by tests to assert the default state.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isDocumentTranslationProviderConfigured(env = process.env) {
  return resolveProviderConfig(env).configured;
}
