/** Default live session cap: 30 minutes. */
export const LIVE_SESSION_MAX_MS = 30 * 60 * 1000;

/** Warn when this many ms remain (25 min elapsed → 5 min left). */
export const LIVE_SESSION_WARN_AT_MS = [25 * 60 * 1000, 29 * 60 * 1000];

/**
 * Dev-only shorter cap via VITE_LIVE_TRANSLATION_DEV_SESSION_MS (e.g. 120000 for 2 min).
 * @returns {number}
 */
export function resolveLiveSessionMaxMs() {
  if (import.meta.env?.DEV && import.meta.env.VITE_LIVE_TRANSLATION_DEV_SESSION_MS) {
    const parsed = Number(import.meta.env.VITE_LIVE_TRANSLATION_DEV_SESSION_MS);
    if (Number.isFinite(parsed) && parsed >= 30_000) {
      return parsed;
    }
  }
  return LIVE_SESSION_MAX_MS;
}

/**
 * @param {number} maxMs
 * @returns {number[]}
 */
export function resolveLiveSessionWarnAtMs(maxMs) {
  if (maxMs >= LIVE_SESSION_MAX_MS) {
    return LIVE_SESSION_WARN_AT_MS;
  }
  const ratio = maxMs / LIVE_SESSION_MAX_MS;
  return LIVE_SESSION_WARN_AT_MS.map((ms) => Math.floor(ms * ratio));
}

/**
 * @param {number} accumulatedMs
 * @param {number | null} runningSince
 * @param {number} [now]
 */
export function computeActiveSessionElapsedMs(accumulatedMs, runningSince, now = Date.now()) {
  return accumulatedMs + (runningSince != null ? now - runningSince : 0);
}

/**
 * @param {number} elapsedMs
 * @param {number} maxMs
 */
export function formatSessionTimer(elapsedMs, maxMs) {
  const remaining = Math.max(0, maxMs - elapsedMs);
  const totalSec = Math.floor(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
