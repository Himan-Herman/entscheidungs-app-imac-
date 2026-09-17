/**
 * The interpreter's own provider client.
 *
 * Deliberately not `openaiClient.js`: that one is constructed at import time
 * from the shared OPENAI_API_KEY with SDK endpoint defaults. Importing it is
 * how a feature silently regains a credential it was separated from, and it is
 * what all four interpreter services used to do.
 *
 * The client here is built from the interpreter's own configuration and only
 * when that configuration is complete. There is no fallback: an unconfigured
 * interpreter throws before any audio or text is prepared for sending.
 */
import {
  INTERPRETER_PROVIDER_KINDS,
  INTERPRETER_PROVIDER_TIMEOUT_MS,
  resolveInterpreterProviderConfig,
} from "./interpreterProviderConfig.js";

/** @type {{ key: string, client: unknown } | null} */
let cached = null;

/**
 * @returns {Promise<{ client: any, config: any }>}
 * @throws when the interpreter has no configuration of its own
 */
export async function getInterpreterClient(env = process.env) {
  const config = resolveInterpreterProviderConfig(env);
  if (!config.configured) {
    const err = new Error("interpreter_provider_not_configured");
    err.reason = config.reason || config.missing?.join(",");
    throw err;
  }
  if (config.kind === INTERPRETER_PROVIDER_KINDS.FAKE) {
    return { client: null, config };
  }
  // Re-use the client while the credential and endpoint are unchanged; a
  // configuration change must not keep serving the old one.
  const key = `${config.apiKey}|${config.baseUrl}`;
  if (!cached || cached.key !== key) {
    const { default: OpenAI } = await import("openai");
    cached = {
      key,
      client: new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        timeout: INTERPRETER_PROVIDER_TIMEOUT_MS,
      }),
    };
  }
  return { client: cached.client, config };
}

/** Test seam: forget the memoised client. */
export function resetInterpreterClient() {
  cached = null;
}
