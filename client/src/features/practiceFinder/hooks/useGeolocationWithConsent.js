import { useCallback, useState } from "react";

/**
 * Browser geolocation only after explicit consent checkbox — coords kept in memory only.
 */
export function useGeolocationWithConsent() {
  const [consent, setConsent] = useState(false);
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState(null);

  const requestLocation = useCallback(() => {
    if (!consent) {
      setErrorKey("locationConsentRequired");
      return Promise.resolve(null);
    }
    if (!navigator.geolocation) {
      setErrorKey("locationDenied");
      return Promise.resolve(null);
    }

    setLoading(true);
    setErrorKey(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setCoords(next);
          setLoading(false);
          resolve(next);
        },
        () => {
          setCoords(null);
          setErrorKey("locationDenied");
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 },
      );
    });
  }, [consent]);

  const clearLocation = useCallback(() => {
    setCoords(null);
    setErrorKey(null);
  }, []);

  return {
    consent,
    setConsent,
    coords,
    loading,
    errorKey,
    requestLocation,
    clearLocation,
  };
}
