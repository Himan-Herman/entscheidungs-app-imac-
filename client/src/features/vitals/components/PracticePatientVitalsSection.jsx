import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPracticePatientVitals } from "../api/practiceVitalsApi.js";
import VitalCard from "./VitalCard.jsx";
import VitalChart from "./VitalChart.jsx";
import "../styles/Vitals.css";

const ALL_TYPES = ["blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature"];

export default function PracticePatientVitalsSection({ linkId, practiceId }) {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.vitals || getMessages("en").vitals;
  }, [language]);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [noConsent, setNoConsent] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setNoConsent(false);
    try {
      const { res, data } = await fetchPracticePatientVitals(linkId, practiceId, { limit: 200 });
      if (res.status === 403 && data.error === "consent_required") {
        setNoConsent(true);
        setEntries([]);
        return;
      }
      if (res.status === 404 && data.error === "feature_disabled") {
        setEntries([]);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setLoadError(t.loadingError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t.loadingError]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    activeTab === "all" ? entries : entries.filter(e => e.type === activeTab),
    [entries, activeTab]
  );

  const chartEntries = useMemo(() =>
    activeTab === "all" ? [] : filtered,
    [activeTab, filtered]
  );

  const showChart = activeTab !== "all" && chartEntries.length >= 1;

  if (loading) {
    return (
      <div className="vitals-page__loading" aria-live="polite" aria-busy="true">
        <span className="vitals-page__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (noConsent) {
    return (
      <div className="vitals-page__empty">
        <TrendingUp size={44} strokeWidth={1.5} aria-hidden="true" />
        <p>{t.practice?.noConsent ?? "Der Patient hat den Zugriff auf Messwerte noch nicht freigegeben."}</p>
      </div>
    );
  }

  if (loadError) {
    return <p className="vitals-page__error" role="alert">{loadError}</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="vitals-page__empty">
        <TrendingUp size={44} strokeWidth={1.5} aria-hidden="true" />
        <p>{t.practice?.noEntries ?? t.noEntries}</p>
      </div>
    );
  }

  return (
    <div className="vitals-page" aria-label={t.pageHeading}>
      {/* Tab filter */}
      <nav className="vitals-tabs" aria-label="Filter">
        <button
          type="button"
          className={`vitals-tabs__btn${activeTab === "all" ? " vitals-tabs__btn--active" : ""}`}
          onClick={() => setActiveTab("all")}
          aria-pressed={activeTab === "all"}
        >
          {t.tabs.all}
        </button>
        {ALL_TYPES.filter(tp => entries.some(e => e.type === tp)).map(tp => (
          <button
            key={tp}
            type="button"
            className={`vitals-tabs__btn${activeTab === tp ? " vitals-tabs__btn--active" : ""}`}
            onClick={() => setActiveTab(tp)}
            aria-pressed={activeTab === tp}
          >
            {t.tabs[tp]}
          </button>
        ))}
      </nav>

      {/* Chart panel */}
      {showChart && (
        <div className="vitals-chart-panel">
          <div className="vitals-chart-panel__header">
            <h2 className="vitals-chart-panel__title">{t.types[activeTab]} — {t.chart.title}</h2>
            <span className="vitals-chart-panel__ref">{t.refRanges[activeTab]}</span>
          </div>
          <VitalChart entries={chartEntries} type={activeTab} t={t} lang={language} />
        </div>
      )}

      {/* Entries — read-only (no edit/delete handlers) */}
      <div className="vitals-list" aria-live="polite">
        {filtered.map(entry => (
          <VitalCard
            key={entry.id}
            entry={entry}
            t={t}
            lang={language}
            readOnly
          />
        ))}
      </div>
    </div>
  );
}
