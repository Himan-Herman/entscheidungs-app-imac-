/**
 * Reading an env-overridable rate limit, safely.
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * The limits below are overridable so a test run — every request of which
 * arrives from one loopback address — is not throttled against itself. That
 * escape hatch was `Number(process.env.X) || default`, which is silent about
 * everything that can go wrong with it:
 *
 *   X=0          -> 0 is falsy, so the default quietly returns
 *   X=abc        -> NaN is falsy, so the default quietly returns
 *   X=-5         -> negative passes, and every request exceeds it
 *   X=999999     -> passes, and the limit is effectively gone
 *
 * The last one is not hypothetical: it is exactly what a test environment
 * sets, and a copied environment block carries it into production with no
 * warning anywhere.
 *
 * THE RULE
 * --------
 * Outside production the override is honoured as written — high values are the
 * point. In production the value must be a whole number inside the band the
 * limiter declares, and anything else FAILS STARTUP rather than being clamped.
 * Clamping would keep a misconfigured deployment running while quietly
 * ignoring what the operator asked for; refusing to start says so.
 */

/** Collected during module load, reported by validateRateLimitConfig(). */
const problems = [];

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * @param {string} envName
 * @param {{ fallback: number, min: number, max: number, why: string }} band
 *   `max` is the largest value production accepts, not a clamp — exceeding it
 *   is a configuration error. `why` documents the band for the next reader.
 * @returns {number}
 */
export function rateLimitMax(envName, { fallback, min, max, why }) {
  const raw = process.env[envName];
  if (raw === undefined || String(raw).trim() === "") return fallback;

  const value = Number(String(raw).trim());

  if (!isProduction()) {
    // Development and test may set anything positive, including the very high
    // values a loopback test suite needs.
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  if (!Number.isInteger(value) || value < min || value > max) {
    problems.push(
      `${envName}=${JSON.stringify(raw)} is outside the permitted production range ` +
        `${min}..${max} (default ${fallback}). ${why}`,
    );
    // Fall back to the safe default so the value in play is never the bad one,
    // even in the window before startup validation runs.
    return fallback;
  }
  return value;
}

/**
 * @returns {string[]} one message per misconfigured limit; empty when sound.
 */
export function getRateLimitConfigProblems() {
  return [...problems];
}
