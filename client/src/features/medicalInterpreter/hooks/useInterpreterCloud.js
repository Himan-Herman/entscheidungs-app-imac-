import { useCallback, useEffect, useState } from "react";
import { fetchInterpreterStatus } from "../api/interpreterApi.js";
import {
  fetchInterpreterCloudPreference,
  grantInterpreterCloudConsent,
  listCloudSessions,
  revokeInterpreterCloudConsent,
} from "../api/interpreterCloudApi.js";

/**
 * Account-level cloud availability and consent (Phase 3.3).
 */
export function useInterpreterCloud() {
  const [state, setState] = useState({
    loading: true,
    moduleEnabled: false,
    cloudFeatureEnabled: false,
    cloudAvailable: false,
    encryptionReady: false,
    accountConsent: false,
    cloudSessionIds: /** @type {Set<string>} */ (new Set()),
    sessionCount: 0,
    error: false,
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: false }));
    const status = await fetchInterpreterStatus();
    const moduleEnabled = status.ok && status.enabled === true;
    const cloudFeatureEnabled = status.ok && status.cloudEnabled === true;
    const cloudAvailable = status.ok && status.cloudAvailable === true;
    const encryptionReady = status.ok && status.encryptionReady === true;

    if (!moduleEnabled || !cloudFeatureEnabled || !cloudAvailable) {
      setState({
        loading: false,
        moduleEnabled,
        cloudFeatureEnabled,
        cloudAvailable,
        encryptionReady,
        accountConsent: false,
        cloudSessionIds: new Set(),
        sessionCount: 0,
        error: !status.ok,
      });
      return;
    }

    const pref = await fetchInterpreterCloudPreference();
    const accountConsent = pref.ok && pref.cloudEnabled === true;

    /** @type {Set<string>} */
    let cloudSessionIds = new Set();
    let sessionCount = 0;
    if (accountConsent) {
      const list = await listCloudSessions();
      if (list.ok && Array.isArray(list.sessions)) {
        sessionCount = list.sessions.length;
        for (const row of list.sessions) {
          const id = row.sessionId || row.clientSessionId;
          if (typeof id === "string") cloudSessionIds.add(id);
        }
      }
    }

    setState({
      loading: false,
      moduleEnabled,
      cloudFeatureEnabled,
      cloudAvailable,
      encryptionReady,
      accountConsent,
      cloudSessionIds,
      sessionCount,
      error: !pref.ok,
    });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const grantConsent = useCallback(async () => {
    const result = await grantInterpreterCloudConsent();
    if (result.ok) {
      await reload();
    }
    return result;
  }, [reload]);

  const revokeConsent = useCallback(
    async (opts = {}) => {
      const result = await revokeInterpreterCloudConsent(opts);
      if (result.ok) {
        await reload();
      }
      return result;
    },
    [reload],
  );

  return {
    ...state,
    reload,
    grantConsent,
    revokeConsent,
    canUseCloud:
      state.moduleEnabled &&
      state.cloudFeatureEnabled &&
      state.cloudAvailable &&
      state.encryptionReady,
  };
}
