/**
 * External Places API configuration — keys from environment only, never hardcoded.
 */

const PROVIDER = "google";

export function getGooglePlacesApiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  return typeof key === "string" ? key.trim() : "";
}

/** True when a live Places provider key is configured. */
export function isPlacesApiConfigured() {
  return getGooglePlacesApiKey().length > 0;
}

/**
 * Optional local/demo data when explicitly enabled (never in production by default).
 * Set PLACES_DEMO_MODE=true only for development without an API key.
 */
export function isPlacesDemoModeEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.PLACES_DEMO_MODE === "true" ||
    process.env.PLACES_ALLOW_DEMO === "true"
  );
}

export function getPlacesProviderName() {
  return PROVIDER;
}

export class PlacesServiceUnavailableError extends Error {
  constructor() {
    super("places_service_unavailable");
    this.code = "places_service_unavailable";
  }
}

export function assertPlacesApiConfigured() {
  if (!isPlacesApiConfigured() && !isPlacesDemoModeEnabled()) {
    throw new PlacesServiceUnavailableError();
  }
}
