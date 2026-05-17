import { useCallback, useState } from "react";
import { searchPlaces } from "../api/placesApi.js";

/** Matches server PRACTICE_SEARCH_PAGE_SIZE — max results per search / load-more. */
const RESULTS_PAGE_SIZE = 10;

const INITIAL = {
  results: [],
  nextPageToken: null,
  demoMode: false,
  center: null,
  radiusKm: 5,
};

/**
 * @param {string} uiLanguage
 */
export function usePracticeFinderSearch(uiLanguage) {
  const [state, setState] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState(null);

  const runSearch = useCallback(
    async (form, { append = false, coords = null, pageToken = null } = {}) => {
      setLoading(true);
      setErrorKey(null);
      try {
        const payload = await searchPlaces({
          country: form.country.trim(),
          specialty: form.specialty.trim(),
          postalCode: form.postalCode.trim(),
          city: form.city.trim(),
          addressLine: form.addressLine.trim(),
          radiusKm: form.radiusKm,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          pageToken: append ? pageToken : null,
          language: uiLanguage === "de" ? "de" : "en",
        });

        const batch = (payload.results || []).slice(0, RESULTS_PAGE_SIZE);

        setState((prev) => ({
          center: payload.center,
          radiusKm: payload.radiusKm,
          demoMode: payload.demoMode === true,
          nextPageToken: payload.nextPageToken || null,
          results: append ? [...prev.results, ...batch] : batch,
        }));
        return payload;
      } catch (e) {
        const code = e?.code || "search_failed";
        if (e?.status === 429) {
          setErrorKey("errorRateLimit");
        } else if (
          code === "places_service_unavailable" ||
          e?.status === 503
        ) {
          setErrorKey("serviceUnavailable");
        } else {
          setErrorKey(
            code === "validation_country_required"
              ? "errorCountry"
              : code === "validation_specialty_required"
                ? "errorSpecialty"
                : code === "validation_location_required"
                  ? "errorLocation"
                  : code === "geocode_not_found"
                    ? "errorGeocodeNotFound"
                    : code === "geocode_failed"
                      ? "errorGeocode"
                      : "errorGeneric",
          );
        }
        if (!append) {
          setState(INITIAL);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [uiLanguage],
  );

  const reset = useCallback(() => {
    setState(INITIAL);
    setErrorKey(null);
  }, []);

  return {
    results: state.results,
    nextPageToken: state.nextPageToken,
    demoMode: state.demoMode,
    center: state.center,
    radiusKm: state.radiusKm,
    loading,
    errorKey,
    runSearch,
    reset,
    hasSearched: state.center !== null || state.results.length > 0,
  };
}
