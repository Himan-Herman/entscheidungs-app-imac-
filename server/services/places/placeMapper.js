/** Normalized place record for API responses (provider-agnostic shape). */

export function mapPlaceFromGoogle(row) {
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
    openingHoursSummary = weekday.join(" · ");
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
    openingHours: Array.isArray(weekday) ? weekday : [],
    languages: [],
    bookingUrl: null,
  };
}
