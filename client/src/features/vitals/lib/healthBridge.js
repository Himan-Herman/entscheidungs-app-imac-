/**
 * Native health platform bridge — Apple HealthKit (iOS) and Health Connect (Android).
 *
 * Read-only by design: `saveSample` of the underlying plugin is never called and no write
 * permission is ever requested. Only the six vital types MedScoutX already supports are
 * touched — no steps, sleep, location, or workout data.
 *
 * Documentation only: this module moves numbers, it never interprets them. No diagnosis,
 * no assessment, no triage.
 *
 * Structure:
 *   - pure helpers (mapping, unit normalisation, sample → VitalEntry) — testable in Node
 *   - platform access, which loads the Capacitor plugin lazily so the web bundle and the
 *     unit tests never need the native dependency.
 */

import { isNativeApp } from "../../../lib/apiBase.js";

/** Our vital type → plugin data type. Only these six are ever requested. */
export const VITAL_TO_HEALTH_TYPE = Object.freeze({
  blood_pressure: "bloodPressure",
  heart_rate: "heartRate",
  glucose: "bloodGlucose",
  weight: "weight",
  oxygen: "oxygenSaturation",
  temperature: "bodyTemperature",
});

/** Reverse lookup, plugin data type → our vital type. */
export const HEALTH_TYPE_TO_VITAL = Object.freeze(
  Object.fromEntries(Object.entries(VITAL_TO_HEALTH_TYPE).map(([k, v]) => [v, k])),
);

/** Canonical unit per vital type, matching the server's DEFAULT_UNITS. */
export const CANONICAL_UNIT = Object.freeze({
  blood_pressure: "mmHg",
  heart_rate: "bpm",
  glucose: "mg/dL",
  weight: "kg",
  oxygen: "%",
  temperature: "°C",
});

/** First sync window. Deliberately bounded — we do not pull a user's entire history. */
export const INITIAL_SYNC_DAYS = 30;

/**
 * Page size for one readSamples call.
 *
 * IMPORTANT — the plugin has NO cursor pagination for samples. `anchor` exists only on
 * queryWorkouts (QueryWorkoutsOptions/QueryWorkoutsResult); readSamples takes just
 * {dataType,startDate,endDate,limit,ascending} and returns {samples}. We therefore
 * paginate over TIME: read ascending, then continue from the last sample's timestamp.
 */
export const SAMPLES_PER_PAGE = 100;

/**
 * Hard safety ceiling per type and sync. Reaching it means the 30-day window held more
 * readings than we import in one go — the UI must say so; we never claim completeness.
 */
export const MAX_SAMPLES_PER_TYPE = 2000;

/** Guards against a pathological loop if a platform keeps returning the same page. */
const MAX_PAGES_PER_TYPE = 40;

const MAX_EXTERNAL_ID_LEN = 191;

/**
 * Coarse device categories we are willing to claim to the patient and the practice.
 * Anything we cannot positively identify stays null and is shown as the platform
 * itself ("Apple Health" / "Health Connect") — we never guess "Apple Watch".
 */
export const SOURCE_DEVICE = Object.freeze({
  APPLE_WATCH: "apple_watch",
  IPHONE: "iphone",
  SAMSUNG_WATCH: "samsung_watch",
  MANUAL: "manual_entry",
});

/**
 * Map the platform's free-text source name to one of the categories above.
 *
 * Only the category is ever stored or displayed — never the raw name, bundle id,
 * package name or device identifier. An unrecognised source deliberately yields
 * null so the UI falls back to the neutral platform label.
 *
 * @param {unknown} sourceName e.g. "Apple Watch", "Max's iPhone", "Galaxy Watch6"
 * @param {"apple_health"|"health_connect"|null} provider
 * @returns {string|null}
 */
export function deriveSourceDevice(sourceName, provider) {
  if (typeof sourceName !== "string") return null;
  const s = sourceName.toLowerCase();

  if (provider === "apple_health") {
    // Conservative on purpose: HealthKit device names follow "<owner>'s Apple Watch",
    // so the name must END with the device. A third-party app called e.g.
    // "Apple Watch Sync Pro" must NOT be presented to a doctor as an Apple Watch.
    // UNVERIFIED against a real watch record — until then, when in doubt we fall
    // through to null and the UI shows the neutral "Apple Health".
    if (/apple\s*watch$/.test(s.trim())) return SOURCE_DEVICE.APPLE_WATCH;
    if (/iphone$/.test(s.trim())) return SOURCE_DEVICE.IPHONE;
    // "Health" is what HealthKit reports for values typed into Apple Health by hand.
    if (/^health$/.test(s.trim())) return SOURCE_DEVICE.MANUAL;
    return null;
  }

  if (provider === "health_connect") {
    // Only claim a watch when both vendor and form factor are stated.
    // No trailing \b — model names like "Galaxy Watch6" must still match.
    if (/\bsamsung\b|\bgalaxy\b/.test(s) && /\bwatch/.test(s)) {
      return SOURCE_DEVICE.SAMSUNG_WATCH;
    }
    return null;
  }

  return null;
}

/**
 * Which provider id the current device maps to.
 * @returns {"apple_health"|"health_connect"|null} null on web / unknown platform
 */
export function getHealthProvider() {
  if (!isNativeApp()) return null;
  try {
    const platform = window.Capacitor?.getPlatform?.();
    if (platform === "ios") return "apple_health";
    if (platform === "android") return "health_connect";
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Convert one plugin sample into the shape POST /api/patient/wearables/import expects.
 * Returns null when the sample is unusable — callers filter those out.
 *
 * Unit handling is deliberately defensive: platforms disagree on how they express
 * oxygen saturation and temperature, and a wrong unit is a wrong medical number.
 *
 * @param {object} sample HealthSample from the plugin
 * @returns {object|null}
 */
export function normalizeHealthSample(sample) {
  if (!sample || typeof sample !== "object") return null;

  const vitalType = HEALTH_TYPE_TO_VITAL[sample.dataType];
  if (!vitalType) return null;

  const measuredAtRaw = sample.endDate || sample.startDate;
  const measuredMs = Date.parse(measuredAtRaw);
  if (!Number.isFinite(measuredMs)) return null;

  let primary;
  let secondary = null;

  if (vitalType === "blood_pressure") {
    const sys = Number(sample.systolic);
    const dia = Number(sample.diastolic);
    if (!Number.isFinite(sys) || !Number.isFinite(dia)) return null;
    primary = sys;
    secondary = dia;
  } else {
    primary = Number(sample.value);
    if (!Number.isFinite(primary)) return null;

    if (vitalType === "temperature" && sample.unit === "fahrenheit") {
      primary = ((primary - 32) * 5) / 9;
    }
    // HealthKit reports oxygen saturation as a 0–1 fraction, Health Connect as a percent.
    // Anything at or below 1 is treated as a fraction; real SpO2 is never ≤ 1 %.
    if (vitalType === "oxygen" && primary > 0 && primary <= 1) {
      primary = primary * 100;
    }
  }

  // Round to one decimal — avoids float noise like 36.60000000000001 in the record.
  primary = Math.round(primary * 10) / 10;
  if (secondary !== null) secondary = Math.round(secondary * 10) / 10;

  const externalId = buildExternalId(sample, vitalType, measuredMs);
  if (!externalId) return null;

  return {
    type: vitalType,
    valuePrimary: primary,
    valueSecondary: secondary,
    unit: CANONICAL_UNIT[vitalType],
    measuredAt: new Date(measuredMs).toISOString(),
    externalId,
    // Category only — the raw sourceName/sourceId never leaves this function.
    sourceDevice: deriveSourceDevice(sample.sourceName, getHealthProvider()),
  };
}

/**
 * Stable, collision-resistant id so repeated syncs deduplicate server-side.
 * Prefers the platform's own identifier (HealthKit UUID / Health Connect metadata id);
 * falls back to a deterministic composite so a missing id never causes duplicates.
 */
export function buildExternalId(sample, vitalType, measuredMs) {
  const platformId = typeof sample.platformId === "string" ? sample.platformId.trim() : "";
  if (platformId) return platformId.slice(0, MAX_EXTERNAL_ID_LEN);

  const value = vitalType === "blood_pressure"
    ? `${sample.systolic}/${sample.diastolic}`
    : String(sample.value);
  const composite = `${vitalType}:${measuredMs}:${value}`;
  return composite.slice(0, MAX_EXTERNAL_ID_LEN);
}

/**
 * Normalise a batch, dropping unusable samples and collapsing duplicate externalIds.
 * @param {Array<object>} samples
 * @returns {Array<object>}
 */
export function normalizeHealthSamples(samples) {
  if (!Array.isArray(samples)) return [];
  const seen = new Set();
  const out = [];
  for (const s of samples) {
    const entry = normalizeHealthSample(s);
    if (!entry || seen.has(entry.externalId)) continue;
    seen.add(entry.externalId);
    out.push(entry);
  }
  return out;
}

/** Start of the sync window: last successful sync, else the bounded initial window. */
export function resolveSyncStart(lastSyncedAt, now = Date.now()) {
  const last = lastSyncedAt ? Date.parse(lastSyncedAt) : NaN;
  if (Number.isFinite(last) && last < now) {
    // Small overlap so a sample written slightly late is not missed; dedup handles repeats.
    return new Date(last - 60 * 60 * 1000).toISOString();
  }
  return new Date(now - INITIAL_SYNC_DAYS * 86_400_000).toISOString();
}

// ── Native plugin access ────────────────────────────────────────────────────
// Loaded lazily: the web bundle and Node unit tests must never require the plugin.

let pluginPromise = null;

async function loadPlugin() {
  if (!pluginPromise) {
    pluginPromise = import("@capgo/capacitor-health")
      .then((m) => m.Health ?? m.default ?? null)
      .catch(() => null);
  }
  return pluginPromise;
}

/** Test seam — inject a stub plugin. Pass null to restore real loading. */
export function __setHealthPluginForTests(stub) {
  pluginPromise = stub === null ? null : Promise.resolve(stub);
}

/**
 * Whether this device can talk to a native health store at all.
 * Never throws — an unavailable platform is a normal state, not an error.
 */
export async function isHealthAvailable() {
  if (!getHealthProvider()) return false;
  try {
    const plugin = await loadPlugin();
    if (!plugin?.isAvailable) return false;
    const res = await plugin.isAvailable();
    return res?.available === true;
  } catch {
    return false;
  }
}

/** The plugin data types for a set of our vital types. */
function toHealthTypes(vitalTypes) {
  const list = Array.isArray(vitalTypes) && vitalTypes.length
    ? vitalTypes
    : Object.keys(VITAL_TO_HEALTH_TYPE);
  return list.map((t) => VITAL_TO_HEALTH_TYPE[t]).filter(Boolean);
}

/** Map a plugin authorization result back to our vital types. */
function toAuthResult(status) {
  const authorized = (status?.readAuthorized || [])
    .map((t) => HEALTH_TYPE_TO_VITAL[t])
    .filter(Boolean);
  const denied = (status?.readDenied || [])
    .map((t) => HEALTH_TYPE_TO_VITAL[t])
    .filter(Boolean);
  return { authorized, denied };
}

/**
 * Ask the OS for READ access. Must only be called from a deliberate user action —
 * never on app start. Write access is never requested.
 */
export async function requestHealthReadAccess(vitalTypes) {
  const plugin = await loadPlugin();
  if (!plugin?.requestAuthorization) return { authorized: [], denied: [] };
  const status = await plugin.requestAuthorization({ read: toHealthTypes(vitalTypes) });
  return toAuthResult(status);
}

/** Current permission state without prompting (handles later revocation). */
export async function checkHealthReadAccess(vitalTypes) {
  try {
    const plugin = await loadPlugin();
    if (!plugin?.checkAuthorization) return { authorized: [], denied: [] };
    const status = await plugin.checkAuthorization({ read: toHealthTypes(vitalTypes) });
    return toAuthResult(status);
  } catch {
    return { authorized: [], denied: [] };
  }
}

/**
 * Read and normalise samples for the given vital types.
 * One failing type never aborts the rest — partial permission is a normal state.
 *
 * @returns {Promise<{entries: Array<object>, failedTypes: string[]}>}
 */
export async function readHealthEntries({ vitalTypes, startDate, endDate, checkpoints } = {}) {
  const plugin = await loadPlugin();
  if (!plugin?.readSamples) return { entries: [], failedTypes: [], truncatedTypes: [] };

  const types = Array.isArray(vitalTypes) && vitalTypes.length
    ? vitalTypes
    : Object.keys(VITAL_TO_HEALTH_TYPE);
  const start = startDate || resolveSyncStart(null);
  const end = endDate || new Date().toISOString();

  const collected = [];
  const failedTypes = [];
  const truncatedTypes = [];
  /** Per type: newest measuredAt actually read, so a truncated type can resume there. */
  const lastReadAt = {};

  for (const vitalType of types) {
    const dataType = VITAL_TO_HEALTH_TYPE[vitalType];
    if (!dataType) continue;

    // A checkpoint from a previous, truncated sync wins over the global start date —
    // otherwise the readings past the cap would never be reached.
    let cursor = checkpoints?.[vitalType] || start;
    let forType = 0;
    let pages = 0;

    try {
      // Time-window pagination: ascending order lets us resume from the newest sample
      // we have seen. Boundary samples may repeat — the stable externalId dedupes them.
      for (;;) {
        const res = await plugin.readSamples({
          dataType,
          startDate: cursor,
          endDate: end,
          limit: SAMPLES_PER_PAGE,
          ascending: true,
        });
        const page = Array.isArray(res?.samples) ? res.samples : [];
        if (page.length === 0) break;

        collected.push(...page);
        forType += page.length;
        pages += 1;

        // Record the resume point for EVERY page we actually took, including the one
        // that trips the ceiling — otherwise the next sync re-reads that whole page.
        const pageLastTs = Date.parse(
          page[page.length - 1]?.endDate || page[page.length - 1]?.startDate,
        );
        if (Number.isFinite(pageLastTs)) lastReadAt[vitalType] = new Date(pageLastTs).toISOString();

        if (page.length < SAMPLES_PER_PAGE) break;          // window exhausted
        if (forType >= MAX_SAMPLES_PER_TYPE || pages >= MAX_PAGES_PER_TYPE) {
          truncatedTypes.push(vitalType);                    // surfaced to the user
          break;
        }

        const lastTs = Date.parse(page[page.length - 1]?.endDate || page[page.length - 1]?.startDate);
        if (!Number.isFinite(lastTs)) { truncatedTypes.push(vitalType); break; }

        const nextCursor = new Date(lastTs + 1).toISOString();  // +1ms: never re-read the same instant
        if (Date.parse(nextCursor) >= Date.parse(end)) break;   // reached the end of the window: complete

        if (nextCursor === cursor) {
          // The cursor cannot advance — more full pages share one timestamp than a page
          // holds. We stop instead of looping, and say so rather than dropping silently.
          truncatedTypes.push(vitalType);
          break;
        }
        cursor = nextCursor;
      }
    } catch {
      // Typically "not authorised for this type" — expected with partial permission.
      failedTypes.push(vitalType);
    }
  }

  return { entries: normalizeHealthSamples(collected), failedTypes, truncatedTypes, lastReadAt };
}

/** Android only: open the Health Connect settings screen. No-op elsewhere. */
export async function openHealthSettings() {
  try {
    const plugin = await loadPlugin();
    await plugin?.openHealthConnectSettings?.();
  } catch {
    /* best effort */
  }
}
