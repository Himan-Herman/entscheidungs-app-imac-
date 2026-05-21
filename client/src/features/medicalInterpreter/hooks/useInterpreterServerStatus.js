import { useEffect, useState } from "react";
import { fetchInterpreterStatus } from "../api/interpreterApi.js";

/**
 * Runtime server availability (Phase 2.2) — avoids stale client-only build flags.
 */
export function useInterpreterServerStatus() {
  const [state, setState] = useState({
    loading: true,
    enabled: null,
    ttsEnabled: null,
    streamingSttEnabled: null,
    nearRealtimeTranslationEnabled: null,
    streamingTtsEnabled: null,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchInterpreterStatus().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({
          loading: false,
          enabled: false,
          ttsEnabled: false,
          streamingSttEnabled: false,
          nearRealtimeTranslationEnabled: false,
          streamingTtsEnabled: false,
          error: true,
        });
        return;
      }
      setState({
        loading: false,
        enabled: result.enabled === true,
        ttsEnabled: result.ttsEnabled === true,
        streamingSttEnabled: result.streamingSttEnabled === true,
        nearRealtimeTranslationEnabled:
          result.nearRealtimeTranslationEnabled === true,
        streamingTtsEnabled: result.streamingTtsEnabled === true,
        error: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
