import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import {
  fetchPatientActivity,
  postPatientActivityAiSummary,
} from "../api/patientActivityApi.js";
import "../../../styles/PatientInboxPage.css";
import "../../../styles/PatientThreadsPage.css";
import "../../../styles/PatientDataControlPage.css";

const LIST_LIMIT = 80;

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function typeLabel(type, t) {
  const key = `type_${type}`;
  return t[key] || type;
}

export default function PatientActivityPage() {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const t = useMemo(
    () => getMessages(language).patientActivity || getMessages("en").patientActivity,
    [language],
  );

  const typeOptions = useMemo(
    () =>
      Object.keys(t)
        .filter((k) => k.startsWith("type_"))
        .map((k) => k.slice(5))
        .sort(),
    [t],
  );

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [linkId, setLinkId] = useState("");
  const [filters, setFilters] = useState({
    type: "",
    search: "",
    from: "",
    to: "",
    linkId: "",
  });
  const [practices, setPractices] = useState([]);
  const [aiSummary, setAiSummary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const practiceNameByLink = useMemo(() => {
    const map = new Map();
    for (const p of practices) {
      if (p.linkId) map.set(p.linkId, p.practice?.practiceName || null);
    }
    return map;
  }, [practices]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientActivity({
        type: filters.type || undefined,
        q: filters.search.trim() || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        linkId: filters.linkId || undefined,
      });
      if (res.status === 404 && data.error === "feature_disabled") {
        setEvents([]);
        setPractices([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setEvents(Array.isArray(data.events) ? data.events : []);
      setPractices(Array.isArray(data.practices) ? data.practices : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setEvents([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [filters, t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    const lid = searchParams.get("linkId")?.trim();
    if (lid) {
      setLinkId(lid);
      setFilters((prev) => ({ ...prev, linkId: lid }));
    }
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters(e) {
    e.preventDefault();
    setFilters({
      type: typeFilter,
      search,
      from,
      to,
      linkId,
    });
  }

  function onPracticeFilterChange(value) {
    setLinkId(value);
    setFilters((prev) => ({ ...prev, linkId: value }));
  }

  async function loadAi() {
    setAiBusy(true);
    setAiSummary("");
    setError("");
    try {
      const { res, data } = await postPatientActivityAiSummary({
        locale: language,
        linkId: filters.linkId || undefined,
      });
      if (res.status === 503 && data.error === "ai_not_configured") {
        setError(t.aiNotConfigured);
        return;
      }
      if (!res.ok || !data.ok) {
        setError(t.aiSummaryError);
        return;
      }
      setAiSummary(data.summary || "");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="patient-inbox">
      <nav className="patient-activity__nav" aria-label={t.backHub}>
        <Link className="patient-inbox__back" to="/patient/practice">
          {t.backHub}
        </Link>
        <Link className="patient-inbox__back" to="/patient/data-control">
          {t.backDataControl}
        </Link>
      </nav>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
      </header>

      <form className="patient-data-control__filters" onSubmit={applyFilters}>
        <label>
          <span>{t.filterType}</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{t.filterTypeAll}</option>
            {typeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {typeLabel(opt, t)}
              </option>
            ))}
          </select>
        </label>
        {practices.length > 0 ? (
          <label>
            <span>{t.filterPractice}</span>
            <select
              value={linkId}
              onChange={(e) => onPracticeFilterChange(e.target.value)}
              aria-label={t.filterPractice}
            >
              <option value="">{t.allPractices}</option>
              {practices.map((p) => (
                <option key={p.linkId} value={p.linkId}>
                  {p.practice?.practiceName || t.practiceUnknown}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          <span>{t.filterSearch}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.filterSearchPlaceholder}
          />
        </label>
        <label>
          <span>{t.filterFrom}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>{t.filterTo}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" className="patient-threads__btn patient-threads__btn--secondary">
          {t.applyFilters}
        </button>
        <button
          type="button"
          className="patient-threads__btn patient-threads__btn--secondary"
          disabled={aiBusy}
          onClick={loadAi}
        >
          {aiBusy ? t.aiSummaryLoading : t.aiSummaryButton}
        </button>
      </form>

      {aiSummary ? (
        <aside className="patient-data-control__ai-box" aria-labelledby="patient-act-ai">
          <h2 id="patient-act-ai" className="patient-inbox__item-title patient-activity__ai-title">
            {t.aiSummaryHeading}
          </h2>
          <p className="patient-data-control__ai-hint">{t.aiSummaryHint}</p>
          <p className="patient-activity__ai-body">{aiSummary}</p>
        </aside>
      ) : null}

      {loading ? (
        <p className="patient-inbox__muted" role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && events.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && events.length > 0 ? (
        <>
          {events.length >= LIST_LIMIT ? (
            <p className="patient-inbox__muted" role="status">
              {t.listLimitNote.replace("{count}", String(LIST_LIMIT))}
            </p>
          ) : null}
          <ul className="practice-record__activity-list" aria-label={t.listLabel}>
            {events.map((ev) => {
              const practiceName = ev.practicePatientLinkId
                ? practiceNameByLink.get(ev.practicePatientLinkId)
                : null;
              return (
                <li key={ev.id} className="practice-record__activity-item">
                  <div className="practice-record__activity-main">
                    <span className="practice-record__activity-type">
                      {typeLabel(ev.type, t)}
                    </span>
                    {practiceName ? (
                      <span className="practice-record__activity-practice">{practiceName}</span>
                    ) : null}
                  </div>
                  <time className="practice-record__activity-time" dateTime={ev.occurredAt}>
                    {fmt(ev.occurredAt, language)}
                  </time>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
