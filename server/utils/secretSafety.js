/**
 * Secret-safety helpers — never log secret values.
 *
 * Convention for the whole server: secrets (API keys, tokens, passwords,
 * Authorization headers, DATABASE_URL, JWT_SECRET, …) must NEVER be written to
 * logs — not the value, not a prefix, not the length. Log presence/absence only.
 *
 * Use `logEnvStatus()` / `isEnvConfigured()` to report configuration state, and
 * the `REDACTED` constant when a value would otherwise be interpolated into a
 * string. See also utils/startupEnvValidation.js, which logs variable names only.
 */

export const REDACTED = '***redacted***';

/** True if the named env var holds a non-empty value. Never returns the value. */
export function isEnvConfigured(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Log "<name> configured: true|false" — presence only.
 * Never logs the value, a prefix, or the length.
 *
 * @param {string} name  Env var name.
 * @param {(msg: string) => void} [logger]  Defaults to console.log.
 */
export function logEnvStatus(name, logger = console.log) {
  logger(`[env] ${name} configured: ${isEnvConfigured(name)}`);
}
