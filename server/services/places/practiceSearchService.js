import {
  assertPlacesApiConfigured,
  isPlacesApiConfigured,
  isPlacesDemoModeEnabled,
  PlacesServiceUnavailableError,
} from "../../config/placesEnv.js";
import { geocodeAddress } from "./geocoding.js";
import { googlePlacesTextSearch } from "./googlePlacesClient.js";
import { rankPracticeResults } from "./ranking.js";
import { buildDemoResults } from "./demoResults.js";

const MAX_RADIUS_KM = 50;
const DEFAULT_RADIUS_KM = 5;

function clampRadius(km) {
  const n = Number(km);
  if (!Number.isFinite(n)) return DEFAULT_RADIUS_KM;
  return Math.min(MAX_RADIUS_KM, Math.max(1, Math.round(n)));
}

function buildLocationQuery({ country, postalCode, city, addressLine }) {
  return [addressLine, postalCode, city, country].filter(Boolean).join(", ");
}

function buildTextQuery(specialty, country, city) {
  const parts = [specialty, "doctor", "medical practice", city, country].filter(
    Boolean,
  );
  return parts.join(" ");
}

/**
 * @param {object} input
 */
export async function runPracticeSearch(input) {
  assertPlacesApiConfigured();

  const country = String(input.country || "").trim();
  const specialty = String(input.specialty || "").trim();
  if (!country) throw new Error("validation_country_required");
  if (!specialty) throw new Error("validation_specialty_required");

  const radiusKm = clampRadius(input.radiusKm);
  const language = input.language === "de" ? "de" : "en";

  let lat = input.latitude;
  let lng = input.longitude;
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  if (!hasCoords) {
    const geoQuery = buildLocationQuery({
      country,
      postalCode: input.postalCode,
      city: input.city,
      addressLine: input.addressLine,
    });
    if (!geoQuery || geoQuery === country) {
      throw new Error("validation_location_required");
    }

    if (isPlacesDemoModeEnabled() && !isPlacesApiConfigured()) {
      lat = 52.52;
      lng = 13.405;
    } else {
      const geo = await geocodeAddress(geoQuery, language);
      lat = geo.lat;
      lng = geo.lng;
    }
  }

  const center = { lat, lng, radiusKm };

  if (isPlacesDemoModeEnabled() && !isPlacesApiConfigured()) {
    return {
      center,
      radiusKm,
      results: rankPracticeResults(
        buildDemoResults(center, specialty, language),
        center,
      ),
      nextPageToken: null,
      demoMode: true,
    };
  }

  const textQuery = buildTextQuery(specialty, country, input.city);
  const { places, nextPageToken } = await googlePlacesTextSearch({
    textQuery,
    lat,
    lng,
    radiusKm,
    languageCode: language,
    pageToken: input.pageToken || null,
  });

  return {
    center,
    radiusKm,
    results: rankPracticeResults(places, center),
    nextPageToken,
    demoMode: false,
  };
}

export { PlacesServiceUnavailableError };
