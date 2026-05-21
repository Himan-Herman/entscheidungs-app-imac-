import { useCallback, useEffect, useRef, useState } from "react";
import { INTERPRETER_RECONNECTED_BANNER_MS } from "../utils/interpreterReliabilityConstants.js";

/**
 * Offline / reconnect awareness — informational only (no offline mode).
 * @returns {{
 *   isOnline: boolean;
 *   showOfflineBanner: boolean;
 *   showReconnectedBanner: boolean;
 * }}
 */
export function useInterpreterConnectivity() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const wasOfflineRef = useRef(false);
  const reconnectTimerRef = useRef(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onOffline = () => {
      wasOfflineRef.current = true;
      setIsOnline(false);
      setShowReconnectedBanner(false);
      clearReconnectTimer();
    };

    const onOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setShowReconnectedBanner(true);
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          setShowReconnectedBanner(false);
        }, INTERPRETER_RECONNECTED_BANNER_MS);
      }
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      clearReconnectTimer();
    };
  }, [clearReconnectTimer]);

  return {
    isOnline,
    showOfflineBanner: !isOnline,
    showReconnectedBanner: isOnline && showReconnectedBanner,
  };
}
