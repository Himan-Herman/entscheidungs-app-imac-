const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
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

function mapPlace(row) {
  const lat = row.location?.latitude;
  const lng = row.location?.longitude;
  const name =
    typeof row.displayName?.text === "string" ? row.displayName.text : "";
  const placeId = row.id?.replace(/^places\//, "") || row.id || "";
  const mapsUrl =
    row.googleMapsUri ||
    (placeId
      ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`
      : null);
  const routeUrl =
    typeof lat === "number" && typeof lng === "number"
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : mapsUrl;

  let openingHoursSummary = null;
  const weekday = row.regularOpeningHours?.weekdayDescriptions;
  if (Array.isArray(weekday) && weekday.length) {
    openingHoursSummary = weekday.slice(0, 2).join(" · ");
  }

  return {
    placeId,
    name,
    specialty: row.primaryType || (row.types && row.types[0]) || null,
    address: row.formattedAddress || "",
    latitude: lat,
    longitude: lng,
    rating: typeof row.rating === "number" ? row.rating : null,
    reviewCount:
      typeof row.userRatingCount === "number" ? row.userRatingCount : null,
    websiteUrl: row.websiteUri || null,
    mapsUrl,
    routeUrl,
    phone: row.nationalPhoneNumber || null,
    openingHoursSummary,
    languages: [],
    bookingUrl: null,
  };
}

/**
 * @param {{
 *   textQuery: string,
 *   lat: number,
 *   lng: number,
 *   radiusKm: number,
 *   apiKey: string,
 *   languageCode?: string,
 *   pageToken?: string | null,
 *   maxResultCount?: number,
 * }} opts
 */
export async function searchPlacesText(opts) {
  const {
    textQuery,
    lat,
    lng,
    radiusKm,
    apiKey,
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
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[practiceFinder] places HTTP", res.status, errText.slice(0, 200));
    throw new Error("places_http_error");
  }

  const data = await res.json();
  const places = (data.places || []).map(mapPlace);
  return {
    places,
    nextPageToken: data.nextPageToken || null,
  };
}
