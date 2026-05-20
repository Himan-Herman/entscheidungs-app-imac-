import { MEDA_DAILY_QUESTION_LIMIT, MEDA_WINDOW_MS } from "../../config/medaEnv.js";

/** @type {Map<string, number[]>} */
const usageByUser = new Map();

function prune(times, now) {
  return times.filter((t) => now - t < MEDA_WINDOW_MS);
}

/**
 * @param {string} userId
 */
export function getMedaQuota(userId) {
  const now = Date.now();
  const times = prune(usageByUser.get(userId) || [], now);
  const used = times.length;
  const remaining = Math.max(0, MEDA_DAILY_QUESTION_LIMIT - used);
  const oldest = times[0];
  return {
    ok: remaining > 0,
    used,
    remaining,
    limit: MEDA_DAILY_QUESTION_LIMIT,
    resetAt: oldest ? oldest + MEDA_WINDOW_MS : null,
  };
}

/**
 * @param {string} userId
 */
export function recordMedaQuestion(userId) {
  const now = Date.now();
  const times = prune(usageByUser.get(userId) || [], now);
  times.push(now);
  usageByUser.set(userId, times);
  return getMedaQuota(userId);
}

/** Test helper */
export function _resetMedaRateLimits() {
  usageByUser.clear();
}
