import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import { fetchPracticeDataRequests } from "../api/patientDataControlApi.js";
import "../../../styles/PracticeDashboardPage.css";
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

function typeLabel(type, t) {
  const map = {
    deletion: t.typeDeletion,
    access_restriction: t.typeAccessRestriction,
    export: t.typeExport,
  };
  return map[type] || type;
}

function statusLabel(status, t) {
  const map = {
    submitted: t.statusSubmitted,
    in_review: t.statusInReview,
    completed: t.statusCompleted,
    rejected: t.statusRejected,
  };
  return map[status] || status;
}

function patientName(row) {
  const p = row.patient;
  if (!p) return "—";
  const parts = [p.firstName, p.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

export default function PracticeDataRequestsPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).practiceDataRequests ||
      getMessages("en").practiceDataRequests,
    [language],
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_practices_failed");
    const rows = Array.isArray(data.practices) ? data.practices : [];
    setPractices(rows);
    if (!practiceId && rows.length > 0) {
      setPracticeId(rows[0].id);
    }
  }, [practiceId]);

  const loadRequests = useCallback(async () => {
    if (!practiceId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeDataRequests(practiceId);
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setRequests([]);
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
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!practiceId) return;
    const next = new URLSearchParams(searchParams);
    next.set("practiceId", practiceId);
    setSearchParams(next, { replace: true });
  }, [practiceId, searchParams, setSearchParams]);

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
          <select
            value={practiceId}
            onChange={(e) => setPracticeId(e.target.value)}
          >
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.practiceName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loading ? <p>{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && requests.length === 0 ? <p>{t.empty}</p> : null}

      {!loading && !error && requests.length > 0 ? (
        <table className="practice-patients__table" aria-label={t.listCaption}>
          <thead>
            <tr>
              <th scope="col">{t.colPatient}</th>
              <th scope="col">{t.colType}</th>
              <th scope="col">{t.colStatus}</th>
              <th scope="col">{t.colDate}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((row) => (
              <tr key={row.id}>
                <td>{patientName(row)}</td>
                <td>{typeLabel(row.type, t)}</td>
                <td>{statusLabel(row.status, t)}</td>
                <td>{fmt(row.createdAt, language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <p style={{ marginTop: "1.5rem" }}>
        <Link to={`/practice/patients?practiceId=${encodeURIComponent(practiceId)}`}>
          {t.backPatients}
        </Link>
      </p>
    </div>
  );
}
