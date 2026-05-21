import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientTelemedicineSessions } from "../api/patientTelemedicineApi.js";
import "../../../styles/WorkspaceHubPages.css";
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

export default function PatientTelemedicinePage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).patientTelemedicine || getMessages("en").patientTelemedicine,
    [language],
  );
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    const { res, data } = await fetchPatientTelemedicineSessions();
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
  }, [t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="telemedicine-page workspace-hub" lang={language}>
      <header className="workspace-hub__hero">
        <h1>{t.heading}</h1>
        <p className="workspace-hub__sub">{t.intro}</p>
        <Link className="workspace-hub__classic" to="/patient">
          {t.backHub}
        </Link>
      </header>

      {loading ? <p aria-live="polite">{t.loading}</p> : null}
      {error ? (
        <p role="alert" className="practice-overview__status--error">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        sessions.length === 0 ? (
          <p>{t.noSessions}</p>
        ) : (
          <ul className="telemedicine-list" aria-label={t.heading}>
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="telemedicine-card"
                  onClick={() => navigate(`/patient/telemedicine/${s.id}`)}
                >
                  <strong>{s.title || s.id}</strong>
                  <div className="telemedicine-card__meta">
                    <span className="telemedicine-status">{t[`status_${s.status}`] || s.status}</span>
                    {" · "}
                    {fmt(s.scheduledStartAt, language)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </main>
  );
}
