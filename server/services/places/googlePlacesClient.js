import { getGooglePlacesApiKey } from "../../config/placesEnv.js";
import { mapPlaceFromGoogle } from "./placeMapper.js";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
  "places.types",
  "places.nationalPhoneNumber",
  "places.regularOpeningHours",
  "places.websiteUri",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "primaryType",
  "types",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "regularOpeningHours",
  "websiteUri",
  "googleMapsUri",
].join(",");

function apiHeaders(fieldMask) {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": getGooglePlacesApiKey(),
    "X-Goog-FieldMask": fieldMask,
  };
}

/**
 * @param {{
 *   textQuery: string,
 *   lat: number,
 *   lng: number,
 *   radiusKm: number,
 *   languageCode?: string,
 *   pageToken?: string | null,
 *   maxResultCount?: number,
 * }} opts
 */
export async function googlePlacesTextSearch(opts) {
  const {
    textQuery,
    lat,
    lng,
    radiusKm,
    languageCode = "en",
    pageToken = null,
    maxResultCount = 20,
  } = opts;

  const body = {
    textQuery,
    languageCode,
    maxResultCount: Math.min(20, Math.max(1, maxResultCount)),
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(50000, Math.max(500, radiusKm * 1000)),
      },
    },
  };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: apiHeaders(SEARCH_FIELD_MASK),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[places] search HTTP", res.status, errText.slice(0, 200));
    throw new Error("places_http_error");
  }

  const data = await res.json();
  return {
    places: (data.places || []).map(mapPlaceFromGoogle),
    nextPageToken: data.nextPageToken || null,
  };
}

/**
 * @param {string} placeId
 * @param {string} [languageCode]
 */
export async function googlePlaceDetails(placeId, languageCode = "en") {
  const id = String(placeId || "").trim();
  if (!id) throw new Error("validation_place_id_required");

  const resourceId = id.startsWith("places/") ? id : `places/${id}`;
  const url = `https://places.googleapis.com/v1/${resourceId}?languageCode=${encodeURIComponent(languageCode)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: apiHeaders(DETAILS_FIELD_MASK),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[places] details HTTP", res.status, errText.slice(0, 200));
    if (res.status === 404) throw new Error("place_not_found");
    throw new Error("places_details_error");
  }

  const data = await res.json();
  return mapPlaceFromGoogle(data);
}
