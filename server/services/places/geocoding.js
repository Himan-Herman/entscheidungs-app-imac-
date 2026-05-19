import { getGooglePlacesApiKey } from "../../config/placesEnv.js";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

/**
 * Resolve coordinates via Places API (New) text search — same key as practice search.
 * Works when the legacy Geocoding API is disabled on the Google Cloud project.
 * @param {string} query
 * @param {string} [language]
 */
async function geocodeViaPlacesTextSearch(query, language = "en") {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) throw new Error("places_not_configured");

  const languageCode = language === "de" ? "de" : "en";
  const res = await fetch(PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.location,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: String(query).trim(),
      languageCode,
      maxResultCount: 1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("[geocode/places]", res.status, errText.slice(0, 120));
    throw new Error("geocode_failed");
  }

  const data = await res.json();
  const place = data.places?.[0];
  const loc = place?.location;
  if (
    !loc ||
    typeof loc.latitude !== "number" ||
    typeof loc.longitude !== "number"
  ) {
    throw new Error("geocode_zero");
  }

  return {
    lat: loc.latitude,
    lng: loc.longitude,
    formatted: place.formattedAddress || String(query).trim(),
  };
}

/**
 * Legacy Geocoding API (optional — often not enabled when only Places API is on).
 * @param {string} query
 * @param {string} language
 * @param {{ region?: string | null }} options
 */
async function geocodeViaLegacyApi(query, language, options = {}) {
  const apiKey = getGooglePlacesApiKey();
  const params = new URLSearchParams({
    address: query,
    key: apiKey,
    language,
  });
  const region = options.region ? String(options.region).trim().toUpperCase() : null;
  if (region && /^[A-Z]{2}$/.test(region)) {
    params.set("region", region.toLowerCase());
  }

  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error("geocode_http_error");
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) {
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn("[geocode/legacy]", data.status, String(query).slice(0, 100));
    }
    throw new Error(data.status === "ZERO_RESULTS" ? "geocode_zero" : "geocode_failed");
  }
  const loc = data.results[0].geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    throw new Error("geocode_failed");
  }
  return {
    lat: loc.lat,
    lng: loc.lng,
    formatted: data.results[0].formatted_address,
  };
}

/**
 * @param {string} query
 * @param {string} [language]
 * @param {{ region?: string | null }} [options]
 */
export async function geocodeAddress(query, language = "en", options = {}) {
  if (!getGooglePlacesApiKey()) throw new Error("places_not_configured");

  const q = String(query || "").trim();
  if (!q) throw new Error("geocode_zero");

  try {
    return await geocodeViaPlacesTextSearch(q, language);
  } catch (placesErr) {
    if (placesErr?.message === "geocode_zero") {
      try {
        return await geocodeViaLegacyApi(q, language, options);
      } catch {
        throw placesErr;
      }
    }
    try {
      return await geocodeViaLegacyApi(q, language, options);
    } catch (legacyErr) {
      throw legacyErr?.message === "geocode_zero" ? legacyErr : placesErr;
    }
  }
}
