import crypto from "crypto";

export function signLegacyWebhookBody(secret, rawBody) {
  const hex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${hex}`;
}

/**
 * Developer webhook: HMAC-SHA256 over "{timestamp}.{rawBody}".
 * @param {string} secret
 * @param {string} timestamp — unix seconds string
 * @param {string} rawBody
 */
export function signDeveloperWebhook(secret, timestamp, rawBody) {
  const base = `${timestamp}.${rawBody}`;
  return crypto.createHmac("sha256", secret).update(base).digest("hex");
}
