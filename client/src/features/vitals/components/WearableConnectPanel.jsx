import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Watch, Plus, Check, X, ShieldCheck } from "lucide-react";
import {
  fetchWearableProviders,
  fetchWearableConnections,
  connectWearable,
  disconnectWearable,
} from "../api/wearablesApi.js";

/**
 * "Gerät verbinden" section inside Meine Messwerte.
 * Additive: manual entry is unaffected. Provider-neutral. Fails closed and silent
 * when the feature flag is off (renders nothing). Never throws to the page.
 */
export default function WearableConnectPanel({ t }) {
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

  const connByProvider = useMemo(() => {
    const m = new Map();
    for (const conn of connections) m.set(conn.provider, conn);
    return m;
  }, [connections]);

  function providerLabel(id) {
    return c?.providers?.[id] || id;
  }

  function typeLabel(type) {
    return t?.types?.[type] || type;
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
      closeConsent();
      await load();
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setActionError(c?.connectError || "");
    } finally {
      setBusyProvider("");
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

      <p className="wearables__app-hint">{c.appHint}</p>

      {loadError && <p className="wearables__error" role="alert">{loadError}</p>}
      {actionError && <p className="wearables__error" role="alert">{actionError}</p>}

      {loading ? (
        <div className="wearables__loading" aria-live="polite" aria-busy="true">
          <span className="wearables__spinner" aria-hidden="true" />
        </div>
      ) : (
        <ul className="wearables__list">
          {providers.map((p) => {
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
                  </div>

                  <div className="wearables__item-action">
                    {isPlanned ? (
                      <button type="button" className="wearables__btn" disabled aria-disabled="true">
                        {c.comingSoon}
                      </button>
                    ) : isConnected ? (
                      <button
                        type="button"
                        className="wearables__btn wearables__btn--ghost"
                        onClick={() => handleDisconnect(conn)}
                        disabled={busy}
                      >
                        {busy ? c.working : c.disconnect}
                      </button>
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
