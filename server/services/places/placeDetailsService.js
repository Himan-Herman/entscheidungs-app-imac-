import {
  assertPlacesApiConfigured,
  isPlacesDemoModeEnabled,
  isPlacesApiConfigured,
} from "../../config/placesEnv.js";
import { googlePlaceDetails } from "./googlePlacesClient.js";
import { buildDemoResults } from "./demoResults.js";
import { normalizePlacesLanguage } from "./language.js";

/**
 * @param {string} placeId
 * @param {string} [language]
 */
export async function getPlaceDetails(placeId, language = "en") {
  assertPlacesApiConfigured();

  const id = String(placeId || "").trim();
  if (!id) throw new Error("validation_place_id_required");
  const normalizedLanguage = normalizePlacesLanguage(language);

  if (isPlacesDemoModeEnabled() && !isPlacesApiConfigured() && id.startsWith("demo-")) {
    const demo = buildDemoResults(
      { lat: 52.52, lng: 13.405, radiusKm: 5 },
      "demo",
      normalizedLanguage,
    );
    return demo.find((p) => p.placeId === id) || demo[0];
  }

  return googlePlaceDetails(id, normalizedLanguage);
}
