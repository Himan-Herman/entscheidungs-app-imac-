import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, Clock, FileText, Pill, Receipt, X } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchErezept, updateErezeptStatus } from "../api/erezeptApi.js";
import ErezeptCard from "../components/ErezeptCard.jsx";
import "../styles/Erezept.css";

const FILTERS = ["all", "issued", "at_pharmacy", "redeemed", "expired"];

const FILTER_ICONS = {
  all: <Receipt size={14} aria-hidden="true" />,
  issued: <Clock size={14} aria-hidden="true" />,
  at_pharmacy: <Pill size={14} aria-hidden="true" />,
  redeemed: <Check size={14} aria-hidden="true" />,
  expired: <X size={14} aria-hidden="true" />,
};

export default function ErezeptPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.erezept || getMessages("en").erezept;
  }, [language]);

  useEffect(() => { if (t?.pageTitle) document.title = t.pageTitle; }, [t]);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { res, data } = await fetchErezept();
      if (res.status === 404 && data.error === "feature_disabled") { setEntries([]); return; }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setLoadError(t?.loadingError || "Rezepte konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusUpdate(id, status) {
    setSaving(true);
    try {
      const { res } = await updateErezeptStatus(id, status);
      if (res.ok) await load();
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() =>
    activeFilter === "all" ? entries : entries.filter((e) => e.status === activeFilter),
    [entries, activeFilter]
  );

  const counts = useMemo(() => {
    const c = {};
    FILTERS.forEach((f) => { c[f] = f === "all" ? entries.length : entries.filter((e) => e.status === f).length; });
    return c;
  }, [entries]);

  return (
    <main className="erx-page" aria-label={t?.pageHeading || "Rezepte & Verordnungen"}>
      {/* Breadcrumb back to Meine Praxis */}
      <nav className="erx-breadcrumb" aria-label="Breadcrumb">
        <Link to="/patient/practice" className="erx-breadcrumb__back">
          <ChevronLeft size={16} aria-hidden="true" />
          {t?.breadcrumb || "Meine Praxis"}
        </Link>
      </nav>

      <header className="erx-page__header">
        <h1 className="erx-page__title">
          <Receipt size={22} aria-hidden="true" />
          {t?.pageHeading || "Rezepte & Verordnungen"}
        </h1>
        <p className="erx-page__intro">{t?.intro}</p>
        <p className="erx-page__disclaimer">{t?.disclaimer}</p>
      </header>

      <nav className="erx-tabs" aria-label={t?.filtersLabel || "Status-Filter"}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`erx-tabs__btn${activeFilter === f ? " erx-tabs__btn--active" : ""}`}
            onClick={() => setActiveFilter(f)}
            aria-pressed={activeFilter === f}
          >
            {FILTER_ICONS[f]}
            {t?.filters?.[f] || f}
            {counts[f] > 0 && (
              <span className="erx-tabs__count">{counts[f]}</span>
            )}
          </button>
        ))}
      </nav>

      {loadError && <div className="erx-page__error" role="alert">{loadError}</div>}

      {loading ? (
        <div className="erx-page__loading" aria-live="polite" aria-busy="true">
          <span className="erx-page__spinner" aria-hidden="true" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="erx-page__empty">
          <Receipt size={44} strokeWidth={1.2} aria-hidden="true" />
          <p>{activeFilter === "all"
            ? (t?.noEntries || "Noch keine Rezepte vorhanden.")
            : (t?.noEntriesFilter || "Keine Rezepte mit diesem Status.")}
          </p>
          {activeFilter === "all" && (
            <p className="erx-page__empty-hint">{t?.noEntriesHint || "Rezepte erscheinen hier, sobald Ihre Praxis sie ausstellt."}</p>
          )}
        </div>
      ) : (
        <div className="erx-cards">
          {filtered.map((entry) => (
            <ErezeptCard
              key={entry.id}
              entry={entry}
              t={t}
              onStatusUpdate={handleStatusUpdate}
              onDelete={null}
              readOnly={false}
              saving={saving}
            />
          ))}
        </div>
      )}
    </main>
  );
}
