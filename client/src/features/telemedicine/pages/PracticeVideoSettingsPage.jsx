import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchVideoSettings, patchVideoSettings } from "../api/practiceTelemedicineApi.js";
import "../../../styles/PracticeDashboardPage.css";
import "../styles/TelemedicinePages.css";

export default function PracticeVideoSettingsPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceTelemedicine || getMessages("en").practiceTelemedicine,
    [language],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [form, setForm] = useState({
    videoEnabled: true,
    providerType: "sandbox",
    sandboxMode: true,
    externalLinkMode: false,
    consentVersion: "1",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (pid) => {
      if (!pid) return;
      setLoading(true);
      setError("");
      const { res, data } = await fetchVideoSettings(pid);
      if (!res.ok || !data.ok) {
        setError(res.status === 404 ? t.featureDisabled : t.loadError);
      } else if (data.settings) {
        setForm({
          videoEnabled: Boolean(data.settings.videoEnabled),
          providerType: data.settings.providerType || "sandbox",
          sandboxMode: Boolean(data.settings.sandboxMode),
          externalLinkMode: Boolean(data.settings.externalLinkMode),
          consentVersion: data.settings.consentVersion || "1",
        });
      }
      setLoading(false);
    },
    [t.featureDisabled, t.loadError],
  );

  useEffect(() => {
    document.title = t.settingsTitle;
  }, [t.settingsTitle]);

  useEffect(() => {
    void (async () => {
      const res = await authFetch("/api/practices");
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.practices) ? data.practices : [];
      setPractices(list);
      const pid = searchParams.get("practiceId") || list[0]?.id || "";
      setPracticeId(pid);
      if (pid) await reload(pid);
      else setLoading(false);
    })();
  }, [reload, searchParams]);

  const onSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const { res, data } = await patchVideoSettings(practiceId, form);
    setBusy(false);
    if (res.ok && data.ok) {
      setStatus(t.saved);
    } else {
      setError(t.loadError);
    }
  };

  return (
    <main className="telemedicine-page practice-dashboard" lang={language}>
      <nav className="telemedicine-page__nav">
        <Link to={`/practice/telemedicine?practiceId=${encodeURIComponent(practiceId)}`}>
          {t.backList}
        </Link>
        <Link to={`/practice/settings?practiceId=${encodeURIComponent(practiceId)}`}>
          {t.backHub}
        </Link>
      </nav>
      <h1>{t.settingsHeading}</h1>
      <p className="telemedicine-page__intro">{t.intro}</p>

      <label htmlFor="tm-settings-practice">{t.selectPractice}</label>
      <select
        id="tm-settings-practice"
        value={practiceId}
        onChange={(e) => {
          const pid = e.target.value;
          setPracticeId(pid);
          setSearchParams(pid ? { practiceId: pid } : {});
          void reload(pid);
        }}
        style={{ maxWidth: 420, marginBottom: "1rem", display: "block" }}
      >
        {practices.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || p.id}
          </option>
        ))}
      </select>

      {loading ? <p aria-live="polite">{t.loading}</p> : null}
      {error ? (
        <p role="alert" className="practice-overview__status--error">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <form className="telemedicine-form telemedicine-panel" onSubmit={onSave}>
          <label>
            <input
              type="checkbox"
              checked={form.videoEnabled}
              onChange={(e) => setForm((f) => ({ ...f, videoEnabled: e.target.checked }))}
            />{" "}
            {t.videoEnabled}
          </label>
          <label htmlFor="tm-provider">{t.providerType}</label>
          <select
            id="tm-provider"
            value={form.providerType}
            onChange={(e) => setForm((f) => ({ ...f, providerType: e.target.value }))}
          >
            <option value="sandbox">sandbox</option>
            <option value="external_link">external_link</option>
            <option value="jitsi">jitsi</option>
            <option value="daily">daily</option>
            <option value="twilio">twilio</option>
            <option value="whereby">whereby</option>
            <option value="zoom">zoom</option>
            <option value="google_meet">google_meet</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={form.sandboxMode}
              onChange={(e) => setForm((f) => ({ ...f, sandboxMode: e.target.checked }))}
            />{" "}
            {t.sandboxMode}
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.externalLinkMode}
              onChange={(e) => setForm((f) => ({ ...f, externalLinkMode: e.target.checked }))}
            />{" "}
            {t.externalLinkMode}
          </label>
          <label htmlFor="tm-consent-ver">{t.consentVersion}</label>
          <input
            id="tm-consent-ver"
            value={form.consentVersion}
            onChange={(e) => setForm((f) => ({ ...f, consentVersion: e.target.value }))}
          />
          <div className="telemedicine-actions">
            <button type="submit" className="telemedicine-btn telemedicine-btn--primary" disabled={busy}>
              {busy ? t.saving : t.save}
            </button>
          </div>
          {status ? (
            <p aria-live="polite">{status}</p>
          ) : null}
        </form>
      ) : null}
    </main>
  );
}
