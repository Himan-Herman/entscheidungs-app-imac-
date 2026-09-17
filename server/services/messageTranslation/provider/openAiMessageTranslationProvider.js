/**
 * OpenAI-compatible adapter for message translation.
 *
 * Does NOT import the shared `openaiClient.js`, and does not reuse the document
 * translation adapter's configuration either. The key, the endpoint and the
 * model come from the message-specific configuration or this adapter is never
 * constructed at all — see messageTranslationProviderConfig.js for why that
 * separation is the point rather than duplication.
 *
 * Deliberately not enabled: tools, function calling beyond structured output,
 * browsing, retrieval, file attachments, streaming. The model receives a system
 * prompt, one JSON user turn, and a schema to fill in.
 */

import {
  MESSAGE_TRANSLATION_ERRORS,
  MessageTranslationError,
} from "../messageTranslationPolicy.js";
import {
  MESSAGE_TRANSLATION_OUTPUT_SCHEMA,
} from "../prompts/messageTranslationPrompts.js";
import { MESSAGE_PROVIDER_TIMEOUT_MS } from "./messageTranslationProviderConfig.js";

/**
 * @param {import("./messageTranslationProviderConfig.js").MessageProviderConfig} config
 * @param {{ createClient?: Function }} [deps] injection seam for tests; the SDK
 *   is imported lazily so this module can be loaded without exercising it.
 */
export function createOpenAiMessageTranslationProvider(config, deps = {}) {
  if (!config?.configured) {
    // Unreachable through the resolver, which gates on this first. Repeated so
    // the adapter cannot be constructed unsafely by a future caller.
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED, {
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
          baseURL: config.baseUrl,
          timeout: MESSAGE_PROVIDER_TIMEOUT_MS,
          maxRetries: 0, // the retry policy belongs to the service
        });
      })();
    }
    return clientPromise;
  }

  /**
   * @param {{ maskedText: string, targetLanguage: string, systemPrompt: string,
   *           userMessage: string, signal?: AbortSignal }} request
   */
  async function translate(request) {
    const messages = [
      { role: "system", content: request.systemPrompt },
      // The message sits here and only here — a data position, never an
      // instruction position.
      { role: "user", content: request.userMessage },
    ];

    let completion;
    try {
      const api = await client();
      completion = await api.chat.completions.create(
        {
          model: config.model,
          messages,
          // A transformation, not a generation task.
          temperature: 0,
          top_p: 1,
          response_format: {
            type: "json_schema",
            json_schema: MESSAGE_TRANSLATION_OUTPUT_SCHEMA,
          },
        },
        { signal: request.signal },
      );
    } catch (err) {
      throw mapProviderError(err);
    }

    const choice = completion?.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.OUTPUT_REJECTED, {
        reason: "response_truncated",
      });
    }
    return choice?.message?.content ?? "";
  }

  return { kind: "openai", model: config.model, translate };
}

async function defaultClientFactory() {
  const { default: OpenAI } = await import("openai");
  return (options) => new OpenAI(options);
}

/**
 * Maps transport failures onto stable codes.
 *
 * The provider's own message is never attached: it can echo the request, which
 * would put message content into an error object and from there into a log.
 *
 * @param {unknown} err
 */
function mapProviderError(err) {
  if (err instanceof MessageTranslationError) return err;
  const status = Number(err?.status ?? err?.response?.status ?? 0);
  const aborted = err?.name === "AbortError" || /timeout/i.test(String(err?.message ?? ""));
  return new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.PROVIDER_FAILED, {
    ...(status ? { status } : {}),
    ...(aborted ? { reason: "timeout" } : {}),
  });
}
