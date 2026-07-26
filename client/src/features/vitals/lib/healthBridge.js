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
export const INITIAL_SYNC_DAYS = 90;

/** Upper bound per type and per sync, aligned with the server's MAX_IMPORT_BATCH. */
export const MAX_SAMPLES_PER_TYPE = 100;

const MAX_EXTERNAL_ID_LEN = 191;

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
export async function readHealthEntries({ vitalTypes, startDate, endDate } = {}) {
  const plugin = await loadPlugin();
  if (!plugin?.readSamples) return { entries: [], failedTypes: [] };

  const types = Array.isArray(vitalTypes) && vitalTypes.length
    ? vitalTypes
    : Object.keys(VITAL_TO_HEALTH_TYPE);
  const start = startDate || resolveSyncStart(null);
  const end = endDate || new Date().toISOString();

  const collected = [];
  const failedTypes = [];

  for (const vitalType of types) {
    const dataType = VITAL_TO_HEALTH_TYPE[vitalType];
    if (!dataType) continue;
    try {
      const res = await plugin.readSamples({
        dataType,
        startDate: start,
        endDate: end,
        limit: MAX_SAMPLES_PER_TYPE,
      });
      if (Array.isArray(res?.samples)) collected.push(...res.samples);
    } catch {
      // Typically "not authorised for this type" — expected with partial permission.
      failedTypes.push(vitalType);
    }
  }

  return { entries: normalizeHealthSamples(collected), failedTypes };
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
