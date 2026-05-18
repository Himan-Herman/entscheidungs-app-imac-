/**
 * Per API-client rate limits (in-memory MVP).
 */

const WINDOW_MS = 60 * 1000;
const MAX_PER_MIN = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_DAY = 1000;

/** @type {Map<string, { minute: { count: number; start: number }; day: { count: number; start: number } }>} */
const store = new Map();

export function checkPracticeApiRateLimit(clientId) {
  const key = String(clientId);
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = {
      minute: { count: 0, start: now },
      day: { count: 0, start: now },
    };
  }
  if (now - entry.minute.start >= WINDOW_MS) {
    entry.minute = { count: 0, start: now };
  }
  if (now - entry.day.start >= DAY_MS) {
    entry.day = { count: 0, start: now };
  }
  entry.minute.count += 1;
  entry.day.count += 1;
  store.set(key, entry);

  if (entry.minute.count > MAX_PER_MIN || entry.day.count > MAX_PER_DAY) {
    return { limited: true, reason: entry.minute.count > MAX_PER_MIN ? "minute" : "day" };
  }
  return { limited: false };
}
