import {
  assertPlacesApiConfigured,
  isPlacesDemoModeEnabled,
  isPlacesApiConfigured,
} from "../../config/placesEnv.js";
import { googlePlaceDetails } from "./googlePlacesClient.js";
import { buildDemoResults } from "./demoResults.js";

/**
 * @param {string} placeId
 * @param {string} [language]
 */
export async function getPlaceDetails(placeId, language = "en") {
  assertPlacesApiConfigured();

  const id = String(placeId || "").trim();
  if (!id) throw new Error("validation_place_id_required");

  if (isPlacesDemoModeEnabled() && !isPlacesApiConfigured() && id.startsWith("demo-")) {
    const demo = buildDemoResults(
      { lat: 52.52, lng: 13.405, radiusKm: 5 },
      "demo",
      language === "de" ? "de" : "en",
    );
    return demo.find((p) => p.placeId === id) || demo[0];
  }

  return googlePlaceDetails(id, language === "de" ? "de" : "en");
}
