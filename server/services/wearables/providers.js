/**
 * Wearable / health-data provider registry — organizational metadata only.
 * Provider-neutral by design: the same connection + import contract serves the native
 * companion app (Apple Health / Health Connect, on-device) and, later, cloud providers
 * (Withings, Fitbit, Oura, Garmin) via OAuth. No secrets, tokens, or endpoints live here.
 *
 * `kind`:
 *   "native_bridge" — data is read on-device by the native app and pushed to /import.
 *   "cloud_oauth"   — future: server-side OAuth pull (not wired in Phase 0).
 *
 * `availability`:
 *   "app"     — usable once the native app ships (connect is recorded, import works today).
 *   "planned" — listed for transparency; connecting is blocked until implemented.
 */

export const WEARABLE_PROVIDERS = Object.freeze([
  {
    id: "apple_health",
    kind: "native_bridge",
    availability: "app",
    platform: "ios",
    // Vital types this source can supply — must be a subset of the 6 supported vitals.
    supportedTypes: ["blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature"],
  },
  {
    id: "health_connect",
    kind: "native_bridge",
    availability: "app",
    platform: "android",
    supportedTypes: ["blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature"],
  },
  {
    id: "withings",
    kind: "cloud_oauth",
    availability: "planned",
    platform: "cloud",
    supportedTypes: ["blood_pressure", "heart_rate", "weight", "oxygen", "temperature"],
  },
  {
    id: "fitbit",
    kind: "cloud_oauth",
    availability: "planned",
    platform: "cloud",
    supportedTypes: ["heart_rate", "weight", "oxygen"],
  },
  {
    id: "garmin",
    kind: "cloud_oauth",
    availability: "planned",
    platform: "cloud",
    supportedTypes: ["heart_rate", "oxygen"],
  },
]);

const PROVIDER_BY_ID = new Map(WEARABLE_PROVIDERS.map((p) => [p.id, p]));

/** @param {string} id */
export function getProvider(id) {
  return PROVIDER_BY_ID.get(id) || null;
}

/** @param {string} id */
export function isKnownProvider(id) {
  return PROVIDER_BY_ID.has(id);
}

/** Providers a patient can actually connect right now (native bridge, app-backed). */
export function isConnectableProvider(id) {
  const p = PROVIDER_BY_ID.get(id);
  return !!p && p.availability === "app";
}

/**
 * Normalise a requested scope list against a provider's real capabilities.
 * Data minimisation: keep only known vital types the provider can supply.
 * Empty / missing request → all of the provider's supported types.
 * @param {string} providerId
 * @param {unknown} requested
 * @returns {string[]}
 */
export function sanitizeScopes(providerId, requested) {
  const p = PROVIDER_BY_ID.get(providerId);
  if (!p) return [];
  if (!Array.isArray(requested) || requested.length === 0) return [...p.supportedTypes];
  const allowed = new Set(p.supportedTypes);
  const seen = new Set();
  const out = [];
  for (const s of requested) {
    if (typeof s === "string" && allowed.has(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}
