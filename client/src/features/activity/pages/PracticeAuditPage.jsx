import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import ResponsiveTableCards from "../../../components/ResponsiveTableCards.jsx";
import "../../../styles/PracticePatientsPage.css";

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

export default function PracticeAuditPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceAudit || getMessages("en").practiceAudit,
    [language],
  );

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState("");
  const [entries, setEntries] = useState([]);
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_practices_failed");
    const rows = Array.isArray(data.practices) ? data.practices : [];
    setPractices(rows);
    if (!practiceId && rows.length > 0) setPracticeId(rows[0].id);
  }, [practiceId]);

  const loadAudit = useCallback(async () => {
    if (!practiceId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ practiceId });
      if (severity) q.set("severity", severity);
      const res = await authFetch(`/api/practice/audit?${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setEntries([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, severity, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    loadPractices().catch(() => setError(t.loadError));
  }, [loadPractices, t.loadError]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  return (
    <div className="practice-dashboard">
      <Link className="practice-dashboard__back" to="/practice">
        {t.backHub}
      </Link>
      <header className="practice-dashboard__header">
        <h1>{t.heading}</h1>
        <p className="practice-dashboard__sub">{t.intro}</p>
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

      <label className="practice-dashboard__filter">
        <span>{t.filterSeverity}</span>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">{t.filterSeverityAll}</option>
          <option value="info">{t.severityInfo}</option>
          <option value="warning">{t.severityWarning}</option>
          <option value="security">{t.severitySecurity}</option>
        </select>
      </label>

      {loading ? <p>{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && entries.length === 0 ? <p>{t.empty}</p> : null}

      {!loading && !error && entries.length > 0 ? (
        <ResponsiveTableCards
          caption={t.listCaption}
          table={
            <table className="practice-patients__table">
              <caption className="practice-team__sr-only">{t.listCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.colAction}</th>
                  <th scope="col">{t.colRole}</th>
                  <th scope="col">{t.colSeverity}</th>
                  <th scope="col">{t.colVisibility}</th>
                  <th scope="col">{t.colDate}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id}>
                    <td>{row.action}</td>
                    <td>{row.actorRole || "—"}</td>
                    <td>{row.severity}</td>
                    <td>{row.visibility}</td>
                    <td>{fmt(row.createdAt, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          cards={entries.map((row) => (
            <article key={row.id} className="practice-patients__card-item ms-responsive-list__card">
              <h2 className="practice-dashboard__muted" style={{ margin: 0, fontSize: "1rem" }}>
                {row.action}
              </h2>
              <dl className="ms-responsive-list__card-row">
                <dt>{t.colRole}</dt>
                <dd>{row.actorRole || "—"}</dd>
                <dt>{t.colSeverity}</dt>
                <dd>{row.severity}</dd>
                <dt>{t.colVisibility}</dt>
                <dd>{row.visibility}</dd>
                <dt>{t.colDate}</dt>
                <dd>
                  <time dateTime={row.createdAt}>{fmt(row.createdAt, language)}</time>
                </dd>
              </dl>
            </article>
          ))}
        />
      ) : null}
    </div>
  );
}
