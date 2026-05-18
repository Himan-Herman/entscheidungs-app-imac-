import { getMessages } from "./translations/index.js";

/**
 * Map API error code to localized user-facing message.
 * @param {string | null | undefined} code
 * @param {string} language
 * @param {string} [fallback]
 */
export function resolveApiErrorMessage(code, language, fallback) {
  const key = String(code || "").trim();
  const messages = getMessages(language);
  const apiErrors = messages.apiErrors || getMessages("en").apiErrors || {};
  if (key && apiErrors[key]) return apiErrors[key];
  if (fallback) return fallback;
  return apiErrors.request_failed || "Request failed.";
}

/**
 * @param {Response} res
 * @param {object} data
 * @param {string} language
 * @param {string} [fallback]
 */
export async function resolveApiErrorFromResponse(res, data, language, fallback) {
  const body = data ?? (await res.json().catch(() => ({})));
  const code = body?.error || body?.code || body?.message;
  return resolveApiErrorMessage(code, language, fallback);
}
