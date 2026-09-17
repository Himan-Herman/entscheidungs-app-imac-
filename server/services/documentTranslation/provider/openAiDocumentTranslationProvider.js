/**
 * OpenAI-compatible adapter for document transformation.
 *
 * ── Its own client, deliberately ────────────────────────────────────────────
 * This module does NOT import the shared `openaiClient.js`. That client is
 * constructed from OPENAI_API_KEY with SDK defaults, and inheriting it would
 * mean the presence of a key for an unrelated feature silently authorises
 * sending medical documents to the same project. Here the key, the base URL and
 * the model come from the translation-specific configuration or the adapter is
 * never constructed at all.
 *
 * ── What is deliberately not enabled ────────────────────────────────────────
 * No tools, no function calling beyond structured output, no browsing, no
 * retrieval, no file attachments, no streaming. The model gets a system prompt,
 * one JSON user message, and a schema to fill in.
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "../documentTranslationPolicy.js";
import {
  buildUserMessage,
  getPromptForMode,
  REPAIR_INSTRUCTION,
  TRANSLATION_OUTPUT_SCHEMA,
} from "../prompts/documentTranslationPrompts.js";
import { PROVIDER_TIMEOUT_MS } from "./documentTranslationProviderConfig.js";
import { TRANSLATION_MODES } from "../documentTranslationPolicy.js";

/**
 * @param {import("./documentTranslationProviderConfig.js").ProviderConfig} config
 * @param {{ createClient?: Function }} [deps] injection seam for tests; the
 *   real SDK is imported lazily so this module can be loaded (and its shape
 *   asserted) without the dependency being exercised.
 */
export function createOpenAiDocumentTranslationProvider(config, deps = {}) {
  if (!config?.configured) {
    // Unreachable through resolveDocumentTranslationProvider, which gates on
    // this first. Repeated here so the adapter cannot be constructed unsafely
    // by a future caller.
    throw new DocumentTranslationError(TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED, {
      reason: "adapter_constructed_without_config",
    });
  }

  let clientPromise = null;

  async function client() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const create = deps.createClient ?? (await defaultClientFactory());
        return create({
          apiKey: config.apiKey,
          // Explicit. No SDK default endpoint is accepted for this feature.
          baseURL: config.baseUrl,
          timeout: PROVIDER_TIMEOUT_MS,
          maxRetries: 0, // retry policy belongs to the service, not the SDK
        });
      })();
    }
    return clientPromise;
  }

  /**
   * @param {{
   *   sourceLanguage: string,
   *   targetLanguage: string,
   *   mode: string,
   *   segments: { index: number, kind: string, text: string, polarity: string }[],
   *   repair?: boolean,
   *   signal?: AbortSignal,
   * }} request
   * @returns {Promise<{ raw: string, model: string }>}
   */
  async function translatePreparedSegments(request) {
    const { systemPrompt } = getPromptForMode(request.mode);
    const model =
      request.mode === TRANSLATION_MODES.STRICT ? config.models.strict : config.models.plain;

    const messages = [
      { role: "system", content: systemPrompt },
      // Document content sits here and only here — a data position, never an
      // instruction position.
      { role: "user", content: buildUserMessage(request) },
    ];
    if (request.repair) {
      messages.push({ role: "system", content: REPAIR_INSTRUCTION });
    }

    let completion;
    try {
      const api = await client();
      completion = await api.chat.completions.create(
        {
          model,
          messages,
          // Lowest deterministic setting. This is a transformation, not a
          // generation task.
          temperature: 0,
          top_p: 1,
          response_format: { type: "json_schema", json_schema: TRANSLATION_OUTPUT_SCHEMA },
        },
        { signal: request.signal },
      );
    } catch (err) {
      throw mapProviderError(err);
    }

    const choice = completion?.choices?.[0];
    if (choice?.finish_reason === "length") {
      // A truncated body would parse as invalid JSON anyway; naming it is more
      // useful for the audit record and for the retry decision.
      throw new DocumentTranslationError(TRANSLATION_ERRORS.INVALID_RESPONSE, {
        reason: "response_truncated",
      });
    }

    return { raw: choice?.message?.content ?? "", model };
  }

  return { kind: "openai", translatePreparedSegments };
}

/* ------------------------------------------------------------- internals */

async function defaultClientFactory() {
  const { default: OpenAI } = await import("openai");
  return (options) => new OpenAI(options);
}

/**
 * Map SDK/transport failures onto stable codes.
 * The provider's own message is never attached: it can echo request content.
 * @param {unknown} err
 */
function mapProviderError(err) {
  if (err instanceof DocumentTranslationError) return err;

  const status = Number(err?.status ?? err?.response?.status ?? 0);
  const name = String(err?.name ?? "");

  if (name === "AbortError" || err?.code === "ERR_CANCELED") {
    return new DocumentTranslationError(TRANSLATION_ERRORS.TIMEOUT, { reason: "aborted" });
  }
  if (status === 429) {
    return new DocumentTranslationError(TRANSLATION_ERRORS.RATE_LIMITED, {
      reason: "provider_rate_limited",
    });
  }
  if (status === 408 || name === "APIConnectionTimeoutError") {
    return new DocumentTranslationError(TRANSLATION_ERRORS.TIMEOUT, {
      reason: "provider_timeout",
    });
  }
  return new DocumentTranslationError(TRANSLATION_ERRORS.PROVIDER_UNAVAILABLE, {
    reason: "provider_error",
    status: status || undefined,
  });
}
