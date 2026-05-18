import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchPatientActivity,
  postPatientActivityAiSummary,
} from "../api/patientActivityApi.js";
import "../../../styles/PatientInboxPage.css";
import "../../../styles/PatientDataControlPage.css";

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
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

const TYPE_OPTIONS = [
  "document_shared",
  "message_received",
  "message_sent",
  "medication_plan_published",
  "profile_viewed",
  "profile_access_granted",
  "profile_access_revoked",
  "data_request_updated",
  "relationship_archived",
];

export default function PatientActivityPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).patientActivity || getMessages("en").patientActivity,
    [language],
  );

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [linkId, setLinkId] = useState("");
  const [practices, setPractices] = useState([]);
  const [aiSummary, setAiSummary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientActivity({
        type: typeFilter || undefined,
        q: search.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        linkId: linkId || undefined,
      });
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
  }, [typeFilter, search, from, to, linkId, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadAi() {
    setAiBusy(true);
    setAiSummary("");
    try {
      const { res, data } = await postPatientActivityAiSummary({
        locale: language,
        linkId: linkId || undefined,
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
      <Link className="patient-inbox__back" to="/patient">
        {t.backHub}
      </Link>
      <Link className="patient-inbox__back" to="/patient/data-control" style={{ marginLeft: "1rem" }}>
        {t.backDataControl}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
      </header>

      <form
        className="patient-data-control__filters"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          <span>{t.filterType}</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{t.filterTypeAll}</option>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {typeLabel(opt, t)}
              </option>
            ))}
          </select>
        </label>
        {practices.length > 0 ? (
          <label>
            <span>{t.allPractices}</span>
            <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              <option value="">{t.allPractices}</option>
              {practices.map((p) => (
                <option key={p.linkId} value={p.linkId}>
                  {p.practice?.practiceName || p.linkId}
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
          <h2 id="patient-act-ai" className="patient-inbox__item-title" style={{ fontSize: "1rem" }}>
            {t.aiSummaryHeading}
          </h2>
          <p className="patient-data-control__ai-hint">{t.aiSummaryHint}</p>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{aiSummary}</p>
        </aside>
      ) : null}

      {loading ? <p className="patient-inbox__muted">{t.loading}</p> : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && events.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && events.length > 0 ? (
        <ul className="practice-record__activity-list" aria-label={t.listLabel}>
          {events.map((ev) => (
            <li key={ev.id} className="practice-record__activity-item">
              <span className="practice-record__activity-type">{typeLabel(ev.type, t)}</span>
              <time className="practice-record__activity-time" dateTime={ev.occurredAt}>
                {fmt(ev.occurredAt, language)}
              </time>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
