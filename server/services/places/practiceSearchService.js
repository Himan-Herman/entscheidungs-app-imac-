import {
  assertPlacesApiConfigured,
  isPlacesApiConfigured,
  isPlacesDemoModeEnabled,
  PlacesServiceUnavailableError,
} from "../../config/placesEnv.js";
import {
  geocodeManualLocation,
  hasManualLocationFields,
} from "./locationQuery.js";
import { googlePlacesTextSearch } from "./googlePlacesClient.js";
import { rankPracticeResults } from "./ranking.js";
import { buildDemoResults } from "./demoResults.js";

const MAX_RADIUS_KM = 50;
const DEFAULT_RADIUS_KM = 5;
/** Max practices returned per search request (initial + each "load more"). */
export const PRACTICE_SEARCH_PAGE_SIZE = 10;

function clampRadius(km) {
  const n = Number(km);
  if (!Number.isFinite(n)) return DEFAULT_RADIUS_KM;
  return Math.min(MAX_RADIUS_KM, Math.max(1, Math.round(n)));
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
    if (!hasManualLocationFields(input)) {
      throw new Error("validation_location_required");
    }

    if (isPlacesDemoModeEnabled() && !isPlacesApiConfigured()) {
      lat = 52.52;
      lng = 13.405;
    } else {
      const geo = await geocodeManualLocation(
        {
          country,
          postalCode: input.postalCode,
          city: input.city,
          addressLine: input.addressLine,
        },
        language,
      );
      lat = geo.lat;
      lng = geo.lng;
    }
  }

  const center = { lat, lng, radiusKm };

  if (isPlacesDemoModeEnabled() && !isPlacesApiConfigured()) {
    const ranked = rankPracticeResults(
      buildDemoResults(center, specialty, language),
      center,
    );
    return {
      center,
      radiusKm,
      results: ranked.slice(0, PRACTICE_SEARCH_PAGE_SIZE),
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
    maxResultCount: PRACTICE_SEARCH_PAGE_SIZE,
  });

  const ranked = rankPracticeResults(places, center);

  return {
    center,
    radiusKm,
    results: ranked.slice(0, PRACTICE_SEARCH_PAGE_SIZE),
    nextPageToken:
      ranked.length > 0 && nextPageToken ? nextPageToken : null,
    demoMode: false,
  };
}

export { PlacesServiceUnavailableError };
