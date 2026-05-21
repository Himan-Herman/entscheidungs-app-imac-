import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  fetchSecuritySummary,
  postSecurityAiSummary,
} from "../api/practiceSecurityApi.js";
import ResponsiveTableCards from "../../../components/ResponsiveTableCards.jsx";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/PracticePatientsPage.css";
import "../../../styles/PracticeSecurityPage.css";

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

export default function PracticeSecurityPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceSecurity || getMessages("en").practiceSecurity,
    [language],
  );

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_practices_failed");
    const rows = Array.isArray(data.practices) ? data.practices : [];
    setPractices(rows);
    if (!practiceId && rows.length > 0) setPracticeId(rows[0].id);
  }, [practiceId]);

  const loadSummary = useCallback(async () => {
    if (!practiceId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const { res, data } = await fetchSecuritySummary(practiceId);
      if (res.status === 403) {
        setForbidden(true);
        setSummary(null);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setSummary(data.summary || null);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setSummary(null);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    loadPractices().catch(() => setError(t.loadError));
  }, [loadPractices, t.loadError]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function handleAiSummary() {
    if (!practiceId) return;
    setAiBusy(true);
    setAiError("");
    try {
      const { res, data } = await postSecurityAiSummary(practiceId, language);
      if (!res.ok || !data.ok) {
        setAiError(t.aiSummaryError);
        return;
      }
      const s = data.summary || {};
      setAiText([s.label, s.disclaimer, s.text].filter(Boolean).join("\n\n"));
    } finally {
      setAiBusy(false);
    }
  }

  const metrics = summary?.metrics || {};
  const events = summary?.recentSecurityEvents || [];
  const principles = summary?.principles || [];

  function eventLabel(eventType) {
    return t.eventTypes?.[eventType] || eventType || t.notProvided;
  }

  if (forbidden) {
    return (
      <div className="practice-dashboard practice-security">
        <Link className="practice-dashboard__back" to="/practice">
          {t.backHub}
        </Link>
        <p className="practice-dashboard__error" role="alert">
          {t.forbidden}
        </p>
      </div>
    );
  }

  return (
    <div className="practice-dashboard practice-security">
      <Link className="practice-dashboard__back" to="/practice">
        {t.backHub}
      </Link>
      <header className="practice-dashboard__header">
        <h1>{t.heading}</h1>
        <p className="practice-dashboard__sub">{t.intro}</p>
        {practiceId ? (
          <p style={{ marginTop: "0.5rem" }}>
            <Link to={`/practice/audit?practiceId=${encodeURIComponent(practiceId)}`}>
              {t.backAudit}
            </Link>
          </p>
        ) : null}
      </header>

      {practices.length > 1 ? (
        <label className="practice-dashboard__filter">
          <span>{t.selectPractice}</span>
          <select value={practiceId} onChange={(e) => setPracticeId(e.target.value)}>
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.practiceName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && summary ? (
        <>
          <section className="practice-security__panel" aria-labelledby="sec-metrics">
            <h2 id="sec-metrics">{t.metricsTitle}</h2>
            <ul className="practice-security__metrics">
              <li>
                <span>{t.metricSecurityEvents7d}</span>
                <strong>{metrics.securityEvents7d ?? t.notProvided}</strong>
              </li>
              <li>
                <span>{t.metricOpenDataRequests}</span>
                <strong>{metrics.openDataRequests ?? t.notProvided}</strong>
              </li>
              <li>
                <span>{t.metricRevokedLinks}</span>
                <strong>{metrics.revokedSecureLinks ?? t.notProvided}</strong>
              </li>
              <li>
                <span>{t.metricActiveLinks}</span>
                <strong>{metrics.activePatientLinks ?? t.notProvided}</strong>
              </li>
              <li>
                <span>{t.metricArchivedLinks}</span>
                <strong>{metrics.archivedPatientLinks ?? t.notProvided}</strong>
              </li>
              <li>
                <span>{t.metricActiveConsents}</span>
                <strong>{metrics.activeConsents ?? t.notProvided}</strong>
              </li>
              <li>
                <span>{t.metricExpiredConsents}</span>
                <strong>{metrics.expiredConsents ?? t.notProvided}</strong>
              </li>
            </ul>
          </section>

          <section className="practice-security__panel" aria-labelledby="sec-principles">
            <h2 id="sec-principles">{t.principlesTitle}</h2>
            <ul className="practice-security__principles">
              {principles.map((key) => (
                <li key={key}>{t.principles?.[key] || key}</li>
              ))}
            </ul>
          </section>

          <section className="practice-security__panel" aria-labelledby="sec-events">
            <h2 id="sec-events">{t.eventsTitle}</h2>
            {events.length === 0 ? (
              <p className="practice-dashboard__muted">{t.eventsEmpty}</p>
            ) : (
              <ResponsiveTableCards
                caption={t.eventsTitle}
                table={
                  <table className="practice-security__table practice-patients__table">
                    <caption className="practice-team__sr-only">{t.eventsTitle}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t.eventColType}</th>
                        <th scope="col">{t.eventColWhen}</th>
                        <th scope="col">{t.eventColRole}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => (
                        <tr key={ev.id}>
                          <td>{eventLabel(ev.eventType)}</td>
                          <td>{fmt(ev.occurredAt, language)}</td>
                          <td>{ev.actorRole || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                cards={events.map((ev) => (
                  <article key={ev.id} className="practice-patients__card-item ms-responsive-list__card">
                    <h3 className="practice-dashboard__muted" style={{ margin: 0, fontSize: "1rem" }}>
                      {eventLabel(ev.eventType)}
                    </h3>
                    <dl className="ms-responsive-list__card-row">
                      <dt>{t.eventColWhen}</dt>
                      <dd>
                        <time dateTime={ev.occurredAt}>{fmt(ev.occurredAt, language)}</time>
                      </dd>
                      <dt>{t.eventColRole}</dt>
                      <dd>{ev.actorRole || "—"}</dd>
                    </dl>
                  </article>
                ))}
              />
            )}
          </section>

          <aside className="practice-security__ai" aria-labelledby="sec-ai">
            <h2 id="sec-ai">{t.aiSummary}</h2>
            <p className="practice-security__ai-hint" role="note">
              {t.aiHint}
            </p>
            <button
              type="button"
              className="practice-dashboard__btn practice-dashboard__btn--secondary"
              onClick={handleAiSummary}
              disabled={aiBusy}
              aria-busy={aiBusy}
            >
              {aiBusy ? t.aiSummaryBusy : t.aiSummary}
            </button>
            {aiError ? (
              <p className="practice-dashboard__error" role="alert">
                {aiError}
              </p>
            ) : null}
            {aiText ? (
              <pre className="practice-security__ai-output">{aiText}</pre>
            ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}
