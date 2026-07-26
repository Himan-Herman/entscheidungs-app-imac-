/**
 * Server-side sanitiser for the optional vitals snapshot a patient may attach to a
 * Pre-Visit document.
 *
 * Defence in depth: the client already builds a data-minimised snapshot, but the
 * `answers` blob is client-supplied, so the server re-derives the allowed shape
 * instead of trusting it. Anything unexpected — extra keys (notably free-text
 * `notes`), unknown types, implausible values, oversized arrays — is dropped.
 *
 * Never throws: a malformed snapshot yields null and the document is stored without it.
 */

import { VALID_TYPES, MAX_VALUES } from "./vitalConstants.js";

/** One entry per measurement type at most. */
const MAX_ITEMS = VALID_TYPES.length;
const MAX_UNIT_LEN = 20;
const MAX_PROVIDER_LEN = 40;
const MAX_AGE_DAYS_CAP = 400;

function finiteOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function inRange(type, primary, secondary) {
  const limits = MAX_VALUES[type];
  if (!limits) return false;
  if (primary < limits.primary[0] || primary > limits.primary[1]) return false;
  if (type === "blood_pressure") {
    if (secondary === null) return false;
    if (secondary < limits.secondary[0] || secondary > limits.secondary[1]) return false;
  }
  return true;
}

/**
 * @param {unknown} raw the client-supplied answers.vitalsSnapshot
 * @param {{now?: number}} [options]
 * @returns {object|null} a clean snapshot, or null when nothing survives
 */
export function sanitizeVitalsSnapshot(raw, options = {}) {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    if (!Array.isArray(raw.items) || raw.items.length === 0) return null;

    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const seenTypes = new Set();
    const items = [];

    for (const entry of raw.items) {
      if (items.length >= MAX_ITEMS) break;
      if (!entry || typeof entry !== "object") continue;

      const { type } = entry;
      if (!VALID_TYPES.includes(type) || seenTypes.has(type)) continue;

      const primary = finiteOrNull(entry.valuePrimary);
      if (primary === null) continue;
      const secondary = type === "blood_pressure" ? finiteOrNull(entry.valueSecondary) : null;
      if (!inRange(type, primary, secondary)) continue;

      const measured = Date.parse(entry.measuredAt);
      if (!Number.isFinite(measured) || measured > now) continue;

      seenTypes.add(type);
      // Rebuilt field by field — unknown keys (e.g. free-text notes) cannot pass through.
      items.push({
        type,
        valuePrimary: primary,
        valueSecondary: secondary,
        unit: typeof entry.unit === "string" ? entry.unit.slice(0, MAX_UNIT_LEN) : "",
        measuredAt: new Date(measured).toISOString(),
        source: entry.source === "import" ? "import" : "manual",
        sourceProvider:
          entry.source === "import" && typeof entry.sourceProvider === "string"
            ? entry.sourceProvider.slice(0, MAX_PROVIDER_LEN)
            : null,
      });
    }

    if (items.length === 0) return null;

    const maxAgeDays = finiteOrNull(raw.maxAgeDays);
    const createdAt = Date.parse(raw.createdAt);

    return {
      version: 1,
      createdAt: Number.isFinite(createdAt) && createdAt <= now
        ? new Date(createdAt).toISOString()
        : new Date(now).toISOString(),
      maxAgeDays: maxAgeDays !== null && maxAgeDays > 0
        ? Math.min(Math.round(maxAgeDays), MAX_AGE_DAYS_CAP)
        : null,
      items,
    };
  } catch {
    return null;
  }
}

/**
 * Return a copy of `answers` whose vitalsSnapshot is sanitised (or removed).
 * Leaves every other key untouched.
 *
 * @param {unknown} answers
 * @returns {unknown} the same value when there is nothing to clean
 */
export function withSanitizedVitalsSnapshot(answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return answers;
  if (!("vitalsSnapshot" in answers)) return answers;

  const clean = sanitizeVitalsSnapshot(answers.vitalsSnapshot);
  const next = { ...answers };
  if (clean) next.vitalsSnapshot = clean;
  else delete next.vitalsSnapshot;
  return next;
}
