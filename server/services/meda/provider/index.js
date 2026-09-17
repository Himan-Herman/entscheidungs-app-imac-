/**
 * Meda provider adapters.
 *
 * The module deliberately does NOT import the shared OpenAI client and does
 * not read OPENAI_API_KEY — that client is constructed from the shared key
 * with SDK defaults, which is exactly what this path stopped inheriting.
 */
import {
  MEDA_PROVIDER_KINDS,
  MEDA_PROVIDER_TIMEOUT_MS,
  resolveMedaProviderConfig,
} from "./medaProviderConfig.js";

/** Test double. Never performs I/O. */
async function fakeComplete({ messages, fakeBehaviour }) {
  if (fakeBehaviour === "error") throw new Error("provider_failed");
  if (fakeBehaviour === "empty") return "";
  const last = messages[messages.length - 1]?.content ?? "";
  return `[meda-fake] ${String(last).slice(0, 120)}`;
}

async function openAiComplete({ config, messages }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDA_PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 100,
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error("provider_failed");
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ messages: {role:string,content:string}[] }} input
 * @returns {Promise<{ ok: true, text: string } | { ok: false, code: string }>}
 */
export async function runMedaProvider({ messages }, env = process.env) {
  const config = resolveMedaProviderConfig(env);
  if (!config.configured) {
    // Fail closed: an incomplete configuration is not a reason to fall back to
    // anything, it is a reason not to send the question at all.
    return { ok: false, code: "provider_not_configured" };
  }
  try {
    const text =
      config.kind === MEDA_PROVIDER_KINDS.FAKE
        ? await fakeComplete({ messages, fakeBehaviour: config.fakeBehaviour })
        : await openAiComplete({ config, messages });
    return { ok: true, text };
  } catch {
    return { ok: false, code: "provider_failed" };
  }
}
