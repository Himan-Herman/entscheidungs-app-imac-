import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientThreads } from "../api/patientThreadsApi.js";
import "../../../styles/PatientInboxPage.css";
import "../../../styles/PatientThreadsPage.css";

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function threadStatusLabel(status, t) {
  const map = {
    open: t.statusOpen,
    closed: t.statusClosed,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

export default function PatientThreadsListPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).patientThreads || getMessages("en").patientThreads,
    [language],
  );

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientThreads();
      if (res.status === 404 && data.error === "feature_disabled") {
        setThreads([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setThreads([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="patient-inbox patient-threads">
      <Link className="patient-inbox__back" to="/patient">
        {t.backHub}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
        <p className="patient-inbox__safety">{t.safetyNote}</p>
      </header>

      {loading ? <p className="patient-inbox__muted">{t.loading}</p> : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && threads.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && threads.length > 0 ? (
        <ul className="patient-threads__list" aria-label={t.listCaption}>
          {threads.map((thread) => {
            const statusText = threadStatusLabel(thread.status, t);
            const statusAria = t.statusAria.replace("{status}", statusText);
            const title = thread.subject?.trim() || t.noSubject;
            const practiceName = thread.practice?.practiceName || t.fromPractice;

            return (
              <li key={thread.id} className="patient-threads__item">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{title}</h2>
                  <span
                    className={`patient-threads__status patient-threads__status--${thread.status}`}
                    aria-label={statusAria}
                  >
                    {statusText}
                  </span>
                </div>
                <p className="patient-inbox__meta" style={{ margin: "0.5rem 0" }}>
                  {practiceName} · {fmt(thread.updatedAt, language)}
                </p>
                <Link
                  className="patient-threads__btn patient-threads__btn--primary"
                  to={`/patient/threads/${encodeURIComponent(thread.id)}`}
                >
                  {t.openThread}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
