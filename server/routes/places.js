/**
 * Secure Places API proxy — Google Places (or future providers) via server only.
 * Routes: GET /status, POST /search, POST /details
 */

import express from "express";
import {
  isPlacesApiConfigured,
  isPlacesDemoModeEnabled,
  getPlacesProviderName,
  PlacesServiceUnavailableError,
  runPracticeSearch,
  getPlaceDetails,
} from "../services/places/index.js";
import { createIpRateLimiter } from "../middleware/ipRateLimit.js";

const router = express.Router();

const searchLimiter = createIpRateLimiter({
  max: 30,
  keyPrefix: "places:search",
});

const detailsLimiter = createIpRateLimiter({
  max: 60,
  keyPrefix: "places:details",
});

function mapError(err) {
  const msg = err?.message || err?.code || "search_failed";
  if (err instanceof PlacesServiceUnavailableError || msg === "places_service_unavailable") {
    return { status: 503, error: "places_service_unavailable" };
  }
  if (msg.startsWith("validation_")) return { status: 400, error: msg };
  if (msg === "geocode_zero") return { status: 400, error: "geocode_not_found" };
  if (msg.startsWith("geocode")) return { status: 502, error: "geocode_failed" };
  if (msg === "place_not_found") return { status: 404, error: "place_not_found" };
  if (msg.startsWith("places")) return { status: 502, error: "search_failed" };
  return { status: 502, error: "search_failed" };
}

/** GET /api/places/status — no API key exposed */
router.get("/status", (_req, res) => {
  const configured = isPlacesApiConfigured();
  return res.json({
    ok: true,
    configured,
    demoMode: !configured && isPlacesDemoModeEnabled(),
    provider: getPlacesProviderName(),
  });
});

/** POST /api/places/search */
router.post("/search", searchLimiter, async (req, res) => {
  const b = req.body || {};
  try {
    const latitude =
      b.latitude === null || b.latitude === undefined || b.latitude === ""
        ? null
        : Number(b.latitude);
    const longitude =
      b.longitude === null || b.longitude === undefined || b.longitude === ""
        ? null
        : Number(b.longitude);

    const payload = await runPracticeSearch({
      country: b.country,
      specialty: b.specialty,
      postalCode: b.postalCode,
      city: b.city,
      addressLine: b.addressLine,
      radiusKm: b.radiusKm,
      latitude:
        Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
          ? latitude
          : null,
      longitude:
        Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
          ? longitude
          : null,
      pageToken: typeof b.pageToken === "string" ? b.pageToken : null,
      language: b.language === "de" ? "de" : "en",
    });

    return res.json({
      ok: true,
      configured: isPlacesApiConfigured(),
      center: payload.center,
      radiusKm: payload.radiusKm,
      results: payload.results,
      nextPageToken: payload.nextPageToken,
      demoMode: payload.demoMode === true,
      resultCount: payload.results.length,
    });
  } catch (err) {
    console.error("[places/search]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/places/details */
router.post("/details", detailsLimiter, async (req, res) => {
  const b = req.body || {};
  try {
    const place = await getPlaceDetails(
      b.placeId,
      b.language === "de" ? "de" : "en",
    );
    return res.json({
      ok: true,
      configured: isPlacesApiConfigured(),
      place,
    });
  } catch (err) {
    console.error("[places/details]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
