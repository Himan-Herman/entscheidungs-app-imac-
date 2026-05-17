import { getGooglePlacesApiKey } from "../../config/placesEnv.js";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * @param {string} query
 * @param {string} [language]
 */
export async function geocodeAddress(query, language = "en") {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) throw new Error("places_not_configured");

  const params = new URLSearchParams({
    address: query,
    key: apiKey,
    language,
  });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error("geocode_http_error");
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(data.status === "ZERO_RESULTS" ? "geocode_zero" : "geocode_failed");
  }
  const loc = data.results[0].geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    throw new Error("geocode_failed");
  }
  return { lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address };
}
