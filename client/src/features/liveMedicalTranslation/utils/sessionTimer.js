/** Production live session cap: 5 minutes. */
export const LIVE_SESSION_MAX_MS = 5 * 60 * 1000;

/** Dev default cap: 60 seconds (cost guard). */
export const LIVE_SESSION_DEV_MAX_MS = 60 * 1000;

/** Warn marks for production 5-minute cap (4:00 and 4:30 elapsed). */
export const LIVE_SESSION_WARN_AT_MS = [4 * 60 * 1000, 4.5 * 60 * 1000];

/**
 * Dev override via VITE_LIVE_TRANSLATION_DEV_SESSION_MS (min 30s).
 * Dev default: 60s. Production default: 5 minutes.
 * @returns {number}
 */
export function resolveLiveSessionMaxMs() {
  if (import.meta.env?.DEV) {
    if (import.meta.env.VITE_LIVE_TRANSLATION_DEV_SESSION_MS) {
      const parsed = Number(import.meta.env.VITE_LIVE_TRANSLATION_DEV_SESSION_MS);
      if (Number.isFinite(parsed) && parsed >= 30_000) {
        return parsed;
      }
    }
    return LIVE_SESSION_DEV_MAX_MS;
  }
  return LIVE_SESSION_MAX_MS;
}

/**
 * @param {number} maxMs
 * @returns {number[]}
 */
export function resolveLiveSessionWarnAtMs(maxMs) {
  if (maxMs <= 90_000) {
    return [Math.floor(maxMs * 0.75), Math.floor(maxMs * 0.92)];
  }
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
