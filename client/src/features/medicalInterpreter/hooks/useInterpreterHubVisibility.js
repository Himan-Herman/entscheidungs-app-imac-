import { useEffect, useState } from "react";
import { fetchInterpreterPracticeStatus } from "../api/interpreterPracticeApi.js";
import { isMedicalInterpreterB2bClientEnabled } from "../config/isMedicalInterpreterB2bEnabled.js";
import { isMedicalInterpreterClientEnabled } from "../config/isMedicalInterpreterEnabled.js";
import { useInterpreterServerStatus } from "./useInterpreterServerStatus.js";

/**
 * Patient hub tile: build-time VITE flag OR runtime GET /api/interpreter/status.
 * Avoids missing tiles when only server env (e.g. Render) is configured.
 */
export function usePatientInterpreterHubVisible() {
  const clientOn = isMedicalInterpreterClientEnabled();
  const server = useInterpreterServerStatus();

  if (clientOn) {
    return { visible: true, loading: false };
  }

  if (server.loading) {
    return { visible: false, loading: true };
  }

  return { visible: server.enabled === true, loading: false };
}

/**
 * Practice hub tile: VITE B2B flag OR runtime practice status when server B2B is on.
 * @param {string} practiceId
 */
export function usePracticeInterpreterHubVisible(practiceId) {
  const clientOn = isMedicalInterpreterB2bClientEnabled();
  const [serverOn, setServerOn] = useState(
    /** @type {boolean | null} */ (clientOn ? true : null),
  );

  useEffect(() => {
    if (clientOn) {
      setServerOn(true);
      return;
    }
    const pid = String(practiceId || "").trim();
    if (!pid) {
      setServerOn(false);
      return;
    }
    let cancelled = false;
    setServerOn(null);
    void fetchInterpreterPracticeStatus({ practiceId: pid }).then((result) => {
      if (cancelled) return;
      const on =
        result.ok === true &&
        result.enabled === true &&
        result.interpreterEnabled === true;
      setServerOn(on);
    });
    return () => {
      cancelled = true;
    };
  }, [clientOn, practiceId]);

  if (!String(practiceId || "").trim()) {
    return { visible: false, loading: false };
  }
  if (clientOn) {
    return { visible: true, loading: false };
  }
  if (serverOn === null) {
    return { visible: false, loading: true };
  }
  return { visible: serverOn === true, loading: false };
}
