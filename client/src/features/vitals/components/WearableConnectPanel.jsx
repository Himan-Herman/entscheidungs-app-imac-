import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Watch, Plus, Check, X, ShieldCheck, RefreshCw, Smartphone } from "lucide-react";
import {
  fetchWearableProviders,
  fetchWearableConnections,
  connectWearable,
  disconnectWearable,
} from "../api/wearablesApi.js";
import {
  getHealthProvider,
  isHealthAvailable,
  requestHealthReadAccess,
  checkHealthReadAccess,
} from "../lib/healthBridge.js";
import { syncHealthData, SYNC_RESULT } from "../lib/healthSync.js";

/**
 * "Gerät verbinden" section inside Meine Messwerte.
 * Additive: manual entry is unaffected. Provider-neutral. Fails closed and silent
 * when the feature flag is off (renders nothing). Never throws to the page.
 */
export default function WearableConnectPanel({ t, locale }) {
  const c = t?.connect;

  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [consentProvider, setConsentProvider] = useState(null); // provider id in consent flow
  const [consentChecked, setConsentChecked] = useState(false);
  const [busyProvider, setBusyProvider] = useState("");
  const [actionError, setActionError] = useState("");

  // ── Native health platform (Phase 2) ──────────────────────────────────────
  const nativeProvider = getHealthProvider();          // apple_health | health_connect | null
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [grantedTypes, setGrantedTypes] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  const consentBoxRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const provRes = await fetchWearableProviders();
      if (provRes.res.status === 404 && provRes.data?.error === "feature_disabled") {
        setDisabled(true);
        return;
      }
      if (!provRes.res.ok || !provRes.data?.ok) throw new Error("load_failed");
      setProviders(Array.isArray(provRes.data.providers) ? provRes.data.providers : []);

      const connRes = await fetchWearableConnections();
      if (connRes.res.ok && connRes.data?.ok) {
        setConnections(Array.isArray(connRes.data.connections) ? connRes.data.connections : []);
      }
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setLoadError(c?.loadError || "");
    } finally {
      setLoading(false);
    }
  }, [c]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (consentProvider && consentBoxRef.current) {
      consentBoxRef.current.focus();
    }
  }, [consentProvider]);

  // Detect the native health store and re-read the OS permission state.
  // Read-only check — this never opens a system dialog.
  const refreshHealthState = useCallback(async () => {
    if (!nativeProvider) return;
    const available = await isHealthAvailable();
    setHealthAvailable(available);
    if (!available) { setGrantedTypes([]); return; }
    const { authorized } = await checkHealthReadAccess();
    setGrantedTypes(authorized);
  }, [nativeProvider]);

  useEffect(() => { void refreshHealthState(); }, [refreshHealthState]);

  const connByProvider = useMemo(() => {
    const m = new Map();
    for (const conn of connections) m.set(conn.provider, conn);
    return m;
  }, [connections]);

  /**
   * Never offer a platform the device cannot use: Apple Health only on iOS,
   * Health Connect only on Android. On web both are hidden and an explanatory
   * hint is shown instead. Cloud providers ("planned") stay visible everywhere.
   */
  const visibleProviders = useMemo(() => {
    const NATIVE = new Set(["apple_health", "health_connect"]);
    return providers.filter((p) => !NATIVE.has(p.id) || p.id === nativeProvider);
  }, [providers, nativeProvider]);

  function providerLabel(id) {
    return c?.providers?.[id] || id;
  }

  function typeLabel(type) {
    return t?.types?.[type] || type;
  }

  function fmtWhen(iso) {
    try {
      return new Date(iso).toLocaleString(locale || undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return String(iso).slice(0, 16).replace("T", " ");
    }
  }

  function openConsent(providerId) {
    setActionError("");
    setConsentChecked(false);
    setConsentProvider(providerId);
  }

  function closeConsent() {
    setConsentProvider(null);
    setConsentChecked(false);
  }

  async function confirmConnect(provider) {
    if (!consentChecked) return;
    setBusyProvider(provider);
    setActionError("");
    try {
      const { res, data } = await connectWearable({ provider, consentAccepted: true });
      if (!res.ok || !data?.ok) throw new Error(data?.error || "connect_failed");

      // Only now — after a deliberate user action and the Art. 9 consent — do we ask
      // the operating system for read access. Never on app start.
      if (provider === nativeProvider && healthAvailable) {
        try {
          const scopes = data?.connection?.scopes;
          const { authorized } = await requestHealthReadAccess(scopes);
          setGrantedTypes(authorized);
          if (authorized.length === 0) setActionError(c?.permissionDenied || "");
        } catch {
          setActionError(c?.permissionDenied || "");
        }
      }

      closeConsent();
      await load();
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setActionError(c?.connectError || "");
    } finally {
      setBusyProvider("");
    }
  }

  /** Manual foreground sync. No background sync exists in this version. */
  async function handleSyncNow(conn) {
    setSyncing(true);
    setSyncNote("");
    setActionError("");
    try {
      const r = await syncHealthData({ scopes: conn.scopes, lastSyncedAt: conn.lastSyncedAt });
      const map = {
        [SYNC_RESULT.OK]: (c?.syncDone || "")
          .replace("{n}", String(r.imported))
          .replace("{dup}", String(r.duplicates))
          .replace("{skip}", String(r.skipped)),
        [SYNC_RESULT.NOTHING_NEW]: c?.syncNothingNew,
        [SYNC_RESULT.NO_PERMISSION]: c?.permissionDenied,
        [SYNC_RESULT.NO_PLATFORM]: c?.webOnlyHint,
        [SYNC_RESULT.OFFLINE]: c?.syncOffline,
        [SYNC_RESULT.SERVER_ERROR]: c?.syncError,
      };
      let note = map[r.result] || "";
      // Never claim completeness: if a type hit the safety ceiling, say so.
      if (r.truncatedTypes?.length) {
        note += ` ${(c?.syncTruncated || "").replace("{types}", r.truncatedTypes.map(typeLabel).join(", "))}`;
      }
      setSyncNote(note.trim());
      await refreshHealthState();
      await load();
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setSyncNote(c?.syncError || "");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect(conn) {
    setBusyProvider(conn.provider);
    setActionError("");
    try {
      const { res, data } = await disconnectWearable(conn.id);
      if (!res.ok || !data?.ok) throw new Error("disconnect_failed");
      await load();
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setActionError(c?.disconnectError || "");
    } finally {
      setBusyProvider("");
    }
  }

  if (disabled || !c) return null;

  return (
    <section className="wearables" aria-labelledby="wearables-heading">
      <div className="wearables__header">
        <Watch size={20} aria-hidden="true" />
        <div>
          <h2 id="wearables-heading" className="wearables__title">{c.heading}</h2>
          <p className="wearables__intro">{c.intro}</p>
        </div>
      </div>

      {/* On web the native stores are unreachable — say so plainly instead of
          offering a button that cannot work. */}
      {nativeProvider ? (
        healthAvailable ? null : (
          <p className="wearables__app-hint">
            {nativeProvider === "health_connect" ? c.healthConnectMissing : c.healthUnavailable}
          </p>
        )
      ) : (
        <p className="wearables__app-hint">
          <Smartphone size={15} aria-hidden="true" /> {c.webOnlyHint}
        </p>
      )}

      <p className="wearables__app-hint">{c.appHint}</p>

      {loadError && <p className="wearables__error" role="alert">{loadError}</p>}
      {actionError && <p className="wearables__error" role="alert">{actionError}</p>}
      {syncNote && <p className="wearables__sync-note" role="status">{syncNote}</p>}

      {loading ? (
        <div className="wearables__loading" aria-live="polite" aria-busy="true">
          <span className="wearables__spinner" aria-hidden="true" />
        </div>
      ) : (
        <ul className="wearables__list">
          {visibleProviders.map((p) => {
            const conn = connByProvider.get(p.id);
            const isConnected = conn && conn.status === "connected";
            const isPlanned = p.availability !== "app";
            const busy = busyProvider === p.id;
            const inConsent = consentProvider === p.id;

            return (
              <li key={p.id} className="wearables__item">
                <div className="wearables__item-main">
                  <div className="wearables__item-text">
                    <span className="wearables__provider-name">{providerLabel(p.id)}</span>
                    {isConnected && (
                      <span className="wearables__badge wearables__badge--connected">
                        <Check size={13} aria-hidden="true" /> {c.connected}
                      </span>
                    )}
                    {isPlanned && (
                      <span className="wearables__badge wearables__badge--planned">{c.planned}</span>
                    )}
                    <span className="wearables__provider-types">
                      {p.supportedTypes.map(typeLabel).join(" · ")}
                    </span>

                    {isConnected && p.id === nativeProvider && (
                      <span className="wearables__meta">
                        {healthAvailable && (
                          <>
                            {grantedTypes.length === 0
                              ? c.permissionNone
                              : grantedTypes.length < p.supportedTypes.length
                                ? (c.permissionPartial || "").replace("{types}", grantedTypes.map(typeLabel).join(", "))
                                : c.permissionAll}
                            {" · "}
                          </>
                        )}
                        {conn.lastSyncedAt
                          ? (c.lastSync || "").replace("{when}", fmtWhen(conn.lastSyncedAt))
                          : c.neverSynced}
                      </span>
                    )}
                  </div>

                  <div className="wearables__item-action">
                    {isPlanned ? (
                      <button type="button" className="wearables__btn" disabled aria-disabled="true">
                        {c.comingSoon}
                      </button>
                    ) : isConnected ? (
                      <div className="wearables__actions-row">
                        {p.id === nativeProvider && healthAvailable && (
                          <button
                            type="button"
                            className="wearables__btn wearables__btn--primary"
                            onClick={() => handleSyncNow(conn)}
                            disabled={syncing || busy}
                            aria-busy={syncing}
                          >
                            <RefreshCw size={15} aria-hidden="true" />
                            {syncing ? c.syncing : c.syncNow}
                          </button>
                        )}
                        <button
                          type="button"
                          className="wearables__btn wearables__btn--ghost"
                          onClick={() => handleDisconnect(conn)}
                          disabled={busy || syncing}
                        >
                          {busy ? c.working : c.disconnect}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="wearables__btn wearables__btn--primary"
                        onClick={() => openConsent(p.id)}
                        disabled={busy || inConsent}
                        aria-expanded={inConsent}
                      >
                        <Plus size={16} aria-hidden="true" />
                        {c.connect}
                      </button>
                    )}
                  </div>
                </div>

                {inConsent && (
                  <div
                    className="wearables__consent"
                    role="group"
                    aria-label={c.consentTitle}
                    ref={consentBoxRef}
                    tabIndex={-1}
                  >
                    <p className="wearables__consent-title">
                      <ShieldCheck size={16} aria-hidden="true" /> {c.consentTitle}
                    </p>
                    <p className="wearables__consent-body">
                      {(c.consentBody || "").replace("{provider}", providerLabel(p.id))}
                    </p>
                    <ul className="wearables__consent-points">
                      {(c.consentPoints || []).map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>

                    <label className="wearables__consent-check">
                      <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                      />
                      <span>{c.consentCheckbox}</span>
                    </label>

                    <div className="wearables__consent-actions">
                      <button
                        type="button"
                        className="wearables__btn wearables__btn--primary"
                        onClick={() => confirmConnect(p.id)}
                        disabled={!consentChecked || busy}
                      >
                        {busy ? c.working : c.consentConfirm}
                      </button>
                      <button
                        type="button"
                        className="wearables__btn wearables__btn--ghost"
                        onClick={closeConsent}
                        disabled={busy}
                      >
                        <X size={15} aria-hidden="true" />
                        {c.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
