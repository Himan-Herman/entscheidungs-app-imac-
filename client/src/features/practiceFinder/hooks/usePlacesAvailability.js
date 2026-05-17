import { useCallback, useEffect, useState } from "react";
import { fetchPlacesStatus } from "../api/placesApi.js";

/**
 * Checks whether the backend Places integration is configured (no API key in client).
 */
export function usePlacesAvailability() {
  const [status, setStatus] = useState({
    loading: true,
    configured: false,
    demoMode: false,
    provider: "google",
  });

  const refresh = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true }));
    try {
      const data = await fetchPlacesStatus();
      setStatus({
        loading: false,
        configured: data.configured === true,
        demoMode: data.demoMode === true,
        provider: data.provider || "google",
      });
    } catch {
      setStatus({
        loading: false,
        configured: false,
        demoMode: false,
        provider: "google",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canSearch = status.configured || status.demoMode;

  return { ...status, canSearch, refresh };
}
