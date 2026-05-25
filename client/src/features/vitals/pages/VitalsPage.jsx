import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { createVital, deleteVital, fetchVitals, updateVital } from "../api/vitalsApi.js";
import VitalCard from "../components/VitalCard.jsx";
import VitalChart from "../components/VitalChart.jsx";
import VitalForm from "../components/VitalForm.jsx";
import "../styles/Vitals.css";

const ALL_TYPES = ["blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature"];

export default function VitalsPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.vitals || getMessages("en").vitals;
  }, [language]);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (t?.pageTitle) document.title = t.pageTitle;
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { res, data } = await fetchVitals({ limit: 200 });
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
  }, [t.loadingError]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (editing) {
        const { res } = await updateVital(editing.id, payload);
        if (!res.ok) throw new Error("save_failed");
      } else {
        const { res } = await createVital(payload);
        if (!res.ok) throw new Error("save_failed");
      }
      await load();
      setShowForm(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const { res } = await deleteVital(id);
    if (!res.ok) throw new Error("delete_failed");
    await load();
  }

  function openEdit(entry) {
    setEditing(entry);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAdd() {
    setEditing(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  const filtered = useMemo(() =>
    activeTab === "all" ? entries : entries.filter(e => e.type === activeTab),
    [entries, activeTab]
  );

  const chartEntries = useMemo(() =>
    activeTab === "all" ? [] : filtered,
    [activeTab, filtered]
  );

  const showChart = activeTab !== "all" && chartEntries.length >= 1;

  return (
    <main className="vitals-page" aria-label={t.pageHeading}>
      <div className="vitals-page__header">
        <h1 className="vitals-page__title">{t.pageHeading}</h1>
        <p className="vitals-page__intro">{t.intro}</p>
        <p className="vitals-page__disclaimer">{t.disclaimer}</p>
      </div>

      {!showForm && (
        <button type="button" className="vitals-page__add-btn" onClick={openAdd}>
          <Plus size={18} aria-hidden="true" />
          {t.addEntry}
        </button>
      )}

      {showForm && (
        <VitalForm
          t={t}
          initial={editing}
          onSave={handleSave}
          onCancel={closeForm}
          saving={saving}
        />
      )}

      {/* Tab filter */}
      {!loading && entries.length > 0 && (
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
      )}

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

      {/* States */}
      {loadError && <p className="vitals-page__error" role="alert">{loadError}</p>}

      {loading && (
        <div className="vitals-page__loading" aria-live="polite" aria-busy="true">
          <span className="vitals-page__spinner" aria-hidden="true" />
        </div>
      )}

      {!loading && !loadError && entries.length === 0 && !showForm && (
        <div className="vitals-page__empty">
          <TrendingUp size={44} strokeWidth={1.5} aria-hidden="true" />
          <p>{t.noEntries}</p>
          <p className="vitals-page__empty-hint">{t.noEntriesHint}</p>
        </div>
      )}

      {/* Entries */}
      {!loading && filtered.length > 0 && (
        <div className="vitals-list" aria-live="polite">
          {filtered.map(entry => (
            <VitalCard
              key={entry.id}
              entry={entry}
              t={t}
              lang={language}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </main>
  );
}
