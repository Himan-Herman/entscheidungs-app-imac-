import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../api/authFetch.js";

const TABS = ["delivery", "calendar", "webhooks", "api"];

export default function PracticeIntegrationsPanel({ practiceId, labels }) {
  const t = labels;
  const [tab, setTab] = useState("delivery");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [role, setRole] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [encryptionReady, setEncryptionReady] = useState(true);
  const [recentWebhookEvents, setRecentWebhookEvents] = useState([]);

  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarProvider, setCalendarProvider] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecretConfigured, setWebhookSecretConfigured] = useState(false);
  const [documentDeliveryMode, setDocumentDeliveryMode] = useState("secure_portal");
  const [secureDownloadEnabled, setSecureDownloadEnabled] = useState(true);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [clearWebhookSecret, setClearWebhookSecret] = useState(false);

  const load = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(
        `/api/practices/${encodeURIComponent(practiceId)}/integration-settings`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "load_failed");
      setRole(data.role || "");
      setCanManage(Boolean(data.canManage));
      setEncryptionReady(data.encryptionReady !== false);
      setRecentWebhookEvents(
        Array.isArray(data.recentWebhookEvents) ? data.recentWebhookEvents : [],
      );
      const s = data.settings || {};
      setCalendarEnabled(Boolean(s.calendarEnabled));
      setCalendarProvider(s.calendarProvider || "");
      setWebhookEnabled(Boolean(s.webhookEnabled));
      setWebhookUrl(s.webhookUrl || "");
      setWebhookSecretConfigured(Boolean(s.webhookSecretConfigured));
      setDocumentDeliveryMode(s.documentDeliveryMode || "secure_portal");
      setSecureDownloadEnabled(s.secureDownloadEnabled !== false);
      setWebhookSecret("");
      setClearWebhookSecret(false);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.integrationLoadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.integrationLoadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const deliveryModes = useMemo(
    () => [
      { value: "download_only", label: t.modeDownloadOnly },
      { value: "email", label: t.modeEmail },
      { value: "secure_portal", label: t.modeSecurePortal },
      { value: "webhook", label: t.modeWebhook },
    ],
    [t.modeDownloadOnly, t.modeEmail, t.modeSecurePortal, t.modeWebhook],
  );

  const calendarProviders = useMemo(
    () => [
      { value: "", label: t.calendarProviderUnset },
      { value: "manual", label: "manual" },
      { value: "ics", label: "ics" },
      { value: "google_later", label: "google_later" },
      { value: "microsoft_later", label: "microsoft_later" },
    ],
    [t.calendarProviderUnset],
  );

  async function onSubmit(e) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError("");
    try {
      const body = {
        calendarEnabled,
        calendarProvider: calendarProvider || null,
        webhookEnabled,
        webhookUrl: webhookUrl.trim() || null,
        documentDeliveryMode,
        secureDownloadEnabled,
        webhookSecretClear: clearWebhookSecret,
      };
      if (webhookSecret.trim()) {
        body.webhookSecret = webhookSecret.trim();
      }
      const res = await authFetch(
        `/api/practices/${encodeURIComponent(practiceId)}/integration-settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "save_failed");
      setWebhookSecret("");
      setClearWebhookSecret(false);
      await load();
    } catch (e2) {
      if (e2?.message === "SESSION_EXPIRED") return;
      setError(t.integrationSaveError);
    } finally {
      setSaving(false);
    }
  }

  async function runWebhookTest() {
    if (!canManage) return;
    setTestMsg("");
    try {
      const res = await authFetch(
        `/api/practices/${encodeURIComponent(practiceId)}/integration-settings/webhook-test`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "test_failed");
      setTestMsg(t.webhookTestQueued);
      await load();
    } catch {
      setTestMsg(t.webhookTestFailed);
    }
  }

  if (!practiceId) return null;

  return (
    <div className="practice-int" role="region" aria-label={t.integrationsHeading}>
      <div className="practice-int__tabs" role="tablist">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`practice-int__tab${tab === id ? " practice-int__tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {id === "delivery" ? t.tabDelivery : null}
            {id === "calendar" ? t.tabCalendar : null}
            {id === "webhooks" ? t.tabWebhooks : null}
            {id === "api" ? t.tabApi : null}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="settings-practices__muted">{t.loadingIntegration}</p>
      ) : (
        <form className="practice-int__body" onSubmit={onSubmit}>
          {!canManage ? (
            <p className="settings-practices__muted">{t.readOnlyHint}</p>
          ) : null}
          {!encryptionReady ? (
            <p className="settings-practices__error">{t.encryptionWarning}</p>
          ) : null}

          {tab === "delivery" ? (
            <div className="practice-int__panel">
              <p className="practice-int__lead">{t.deliveryIntro}</p>
              <label className="settings-practices__label">
                {t.fieldDeliveryMode}
                <select
                  className="settings-practices__input"
                  value={documentDeliveryMode}
                  onChange={(e) => setDocumentDeliveryMode(e.target.value)}
                  disabled={!canManage}
                >
                  {deliveryModes.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-practices__check">
                <input
                  type="checkbox"
                  checked={secureDownloadEnabled}
                  onChange={(e) => setSecureDownloadEnabled(e.target.checked)}
                  disabled={!canManage}
                />
                <span>{t.fieldSecureDownload}</span>
              </label>
              <ul className="practice-int__notes">
                <li>{t.noteNoClinicalWebhook}</li>
                <li>{t.noteLinksExpire}</li>
                <li>{t.noteEmailNoSensitive}</li>
                <li>{t.noteConsent}</li>
              </ul>
            </div>
          ) : null}

          {tab === "calendar" ? (
            <div className="practice-int__panel">
              <p className="practice-int__lead">{t.calendarIntro}</p>
              <label className="settings-practices__check">
                <input
                  type="checkbox"
                  checked={calendarEnabled}
                  onChange={(e) => setCalendarEnabled(e.target.checked)}
                  disabled={!canManage}
                />
                <span>{t.fieldCalendarEnabled}</span>
              </label>
              <label className="settings-practices__label">
                {t.fieldCalendarProvider}
                <select
                  className="settings-practices__input"
                  value={calendarProvider}
                  onChange={(e) => setCalendarProvider(e.target.value)}
                  disabled={!canManage}
                >
                  {calendarProviders.map((o) => (
                    <option key={o.value || "unset"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="practice-int__hint">{t.calendarIcsHint}</p>
            </div>
          ) : null}

          {tab === "webhooks" ? (
            <div className="practice-int__panel">
              <p className="practice-int__lead">{t.webhooksIntro}</p>
              <label className="settings-practices__check">
                <input
                  type="checkbox"
                  checked={webhookEnabled}
                  onChange={(e) => setWebhookEnabled(e.target.checked)}
                  disabled={!canManage}
                />
                <span>{t.fieldWebhookEnabled}</span>
              </label>
              <label className="settings-practices__label">
                {t.fieldWebhookUrl}
                <input
                  className="settings-practices__input"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  disabled={!canManage}
                  placeholder="https://"
                  autoComplete="off"
                />
              </label>
              <label className="settings-practices__label">
                {t.fieldWebhookSecret}
                <input
                  className="settings-practices__input"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  disabled={!canManage || !encryptionReady}
                  placeholder={t.webhookSecretPlaceholder}
                  autoComplete="new-password"
                />
              </label>
              {webhookSecretConfigured ? (
                <p className="practice-int__hint">{t.webhookSecretConfiguredHint}</p>
              ) : null}
              <label className="settings-practices__check">
                <input
                  type="checkbox"
                  checked={clearWebhookSecret}
                  onChange={(e) => setClearWebhookSecret(e.target.checked)}
                  disabled={!canManage}
                />
                <span>{t.clearWebhookSecret}</span>
              </label>
              <div className="practice-int__webhook-actions">
                <button
                  type="button"
                  className="settings-practices__btn settings-practices__btn--ghost"
                  disabled={!canManage || !webhookEnabled}
                  onClick={() => void runWebhookTest()}
                >
                  {t.webhookTest}
                </button>
                {testMsg ? <span className="practice-int__test-msg">{testMsg}</span> : null}
              </div>
              <div className="practice-int__events">
                <h4 className="practice-int__events-title">{t.webhookRecent}</h4>
                {recentWebhookEvents.length === 0 ? (
                  <p className="settings-practices__muted">{t.webhookNoEvents}</p>
                ) : (
                  <ul className="practice-int__event-list">
                    {recentWebhookEvents.map((ev) => (
                      <li key={ev.id} className="practice-int__event-row">
                        <span className="practice-int__event-type">{ev.eventType}</span>
                        <span className="practice-int__event-status">{ev.status}</span>
                        <span className="practice-int__event-meta">
                          {ev.attempts ?? 0} · {ev.lastError || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {tab === "api" ? (
            <div className="practice-int__panel">
              <p className="practice-int__lead">{t.apiIntro}</p>
              <p className="practice-int__quote">{t.apiPvsNote}</p>
              <p className="practice-int__hint">{t.apiEndpointsHint}</p>
              <p className="settings-practices__muted">
                {t.apiRoleHint}: {role || "—"}
              </p>
            </div>
          ) : null}

          {error ? <p className="settings-practices__error">{error}</p> : null}

          {canManage ? (
            <div className="practice-int__save">
              <button
                type="submit"
                className="settings-practices__btn settings-practices__btn--primary"
                disabled={saving}
              >
                {t.saveIntegration}
              </button>
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}
