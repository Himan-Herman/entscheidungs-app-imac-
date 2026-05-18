import fetch from "node-fetch";
import { WEBHOOK_HTTP_TIMEOUT_MS } from "./webhookConstants.js";

/**
 * Single HTTP POST attempt — no retries.
 * @param {{ url: string, headers: Record<string, string>, body: string }} opts
 */
export async function postWebhookOnce({ url, headers, body }) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WEBHOOK_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body,
      signal: ac.signal,
    });
    return { statusCode: res.status, networkError: null };
  } catch (e) {
    const networkError =
      e?.name === "AbortError" ? "timeout" : "network_error";
    return { statusCode: null, networkError };
  } finally {
    clearTimeout(timer);
  }
}
