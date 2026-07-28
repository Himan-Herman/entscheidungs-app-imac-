/**
 * Turns a server error code into a sentence the patient can act on.
 *
 * Pure and dependency-free so it can be tested without a browser or a fetch
 * layer. A raw code is never the only thing shown, and no identifier from the
 * response is ever interpolated into the message.
 *
 * @param {{ error?: unknown } | null | undefined} data
 * @param {Record<string, string>} errors the documentSharing.errors bundle
 */
export function shareErrorMessage(data, errors) {
  const code = typeof data?.error === "string" ? data.error : "";
  return errors?.[code] || errors?.server_error || "";
}
