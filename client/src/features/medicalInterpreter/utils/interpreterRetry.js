/**
 * @param {string} [code]
 */
export function isRetryableInterpreterCode(code) {
  return (
    code === "network" ||
    code === "transcribe_timeout" ||
    code === "translate_timeout" ||
    code === "simplify_timeout"
  );
}
