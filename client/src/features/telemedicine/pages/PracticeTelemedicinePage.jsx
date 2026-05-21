import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPracticeTelemedicineSessions } from "../api/practiceTelemedicineApi.js";
import "../../../styles/PracticeDashboardPage.css";
import "../styles/TelemedicinePages.css";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';

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

export default function PracticeTelemedicinePage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceTelemedicine || getMessages("en").practiceTelemedicine,
    [language],
  );
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.practices) ? data.practices : [];
  }, []);

  const reload = useCallback(
    async (pid) => {
      if (!pid) return;
      setLoading(true);
      setError("");
      const { res, data } = await fetchPracticeTelemedicineSessions(pid);
      if (res.status === 404) {
        setError(t.featureDisabled);
        setSessions([]);
      } else if (!res.ok || !data.ok) {
        setError(t.loadError);
        setSessions([]);
      } else {
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      }
      setLoading(false);
    },
    [t.featureDisabled, t.loadError],
  );

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void (async () => {
      const list = await loadPractices();
      setPractices(list);
      const pid = searchParams.get("practiceId") || list[0]?.id || "";
      setPracticeId(pid);
      if (pid) await reload(pid);
      else setLoading(false);
    })();
  }, [loadPractices, reload, searchParams]);

  const onPracticeChange = (e) => {
    const pid = e.target.value;
    setPracticeId(pid);
    setSearchParams(pid ? { practiceId: pid } : {});
    void reload(pid);
  };

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return sessions.filter((s) => {
      if (!s.scheduledStartAt) return false;
      const d = new Date(s.scheduledStartAt);
      return d >= start && d <= end;
    });
  }, [sessions]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return sessions.filter((s) => {
      if (!s.scheduledStartAt) return true;
      return new Date(s.scheduledStartAt) >= now;
    });
  }, [sessions]);

  return (
    <main className="telemedicine-page practice-dashboard" lang={language}>
      <header className="telemedicine-page__header">
        <nav className="telemedicine-page__nav" aria-label={t.heading}>
          <Link to={`/practice?practiceId=${encodeURIComponent(practiceId)}`}>{t.backHub}</Link>
          <Link to={`/practice/calendar?practiceId=${encodeURIComponent(practiceId)}`}>
            {t.openCalendar}
          </Link>
          <Link to={`/practice/settings/video?practiceId=${encodeURIComponent(practiceId)}`}>
            {t.openSettings}
          </Link>
        </nav>
        <h1>{t.heading}</h1>
        <p className="telemedicine-page__intro">{t.intro}</p>
      </header>

      <label htmlFor="tm-practice">{t.selectPractice}</label>
      <select
        id="tm-practice"
        value={practiceId}
        onChange={onPracticeChange}
        className="telemedicine-form"
        style={{ maxWidth: 420, marginBottom: "1rem" }}
      >
        {practices.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || p.id}
          </option>
        ))}
      </select>

      {loading ? (
        <p aria-live="polite">{t.loading}</p>
      ) : null}
      {error ? (
        <p role="alert" className="practice-overview__status--error">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <>
          <h2>{t.waitingRoom}</h2>
          {today.length === 0 ? (
            <p>{t.noSessions}</p>
          ) : (
            <ul className="telemedicine-list" aria-label={t.heading}>
              {today.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="telemedicine-card"
                    onClick={() =>
                      navigate(
                        `/practice/telemedicine/${s.id}?practiceId=${encodeURIComponent(practiceId)}`,
                      )
                    }
                  >
                    <strong>{s.title || s.id}</strong>
                    <div className="telemedicine-card__meta">
                      <span className="telemedicine-status" aria-label={t.status}>
                        {t[`status_${s.status}`] || s.status}
                      </span>
                      {" · "}
                      {fmt(s.scheduledStartAt, language)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ marginTop: "1.5rem" }}>{t.scheduled}</h2>
          {upcoming.length === 0 ? (
            <p>{t.noSessions}</p>
          ) : (
            <ul className="telemedicine-list">
              {upcoming.map((s) => (
                <li key={s.id}>
                  <Link
                    className="telemedicine-btn"
                    to={`/practice/telemedicine/${s.id}?practiceId=${encodeURIComponent(practiceId)}`}
                  >
                    {s.title || s.id} — {fmt(s.scheduledStartAt, language)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </main>
  );
}
