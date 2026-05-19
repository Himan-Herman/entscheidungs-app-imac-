import { getGooglePlacesApiKey } from "../../config/placesEnv.js";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * @param {string} query
 * @param {string} [language]
 * @param {{ region?: string | null }} [options] ISO country code (e.g. DE) for bias + restriction
 */
export async function geocodeAddress(query, language = "en", options = {}) {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) throw new Error("places_not_configured");

  const params = new URLSearchParams({
    address: query,
    key: apiKey,
    language,
  });
  const region = options.region ? String(options.region).trim().toUpperCase() : null;
  if (region && /^[A-Z]{2}$/.test(region)) {
    params.set("region", region.toLowerCase());
    params.set("components", `country:${region}`);
  }

  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error("geocode_http_error");
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) {
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn("[geocode]", data.status, String(query).slice(0, 100));
    }
    throw new Error(data.status === "ZERO_RESULTS" ? "geocode_zero" : "geocode_failed");
  }
  const loc = data.results[0].geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    throw new Error("geocode_failed");
  }
  return { lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address };
}
