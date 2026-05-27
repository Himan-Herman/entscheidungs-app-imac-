/**
 * Cost guard helpers for Meda live Realtime — debug logs only, no transcript persistence.
 */

/** @param {string} text */
export function normalizeTranscriptKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [detail]
 */
export function logCostGuard(event, detail = {}) {
  const payload = { event, ...detail };
  console.debug("[MedaCostGuard]", payload);
}
