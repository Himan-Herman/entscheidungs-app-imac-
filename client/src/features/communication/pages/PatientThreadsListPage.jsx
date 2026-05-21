import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientThreads } from "../api/patientThreadsApi.js";
import PracticeBrandingBar from "../../../components/practice/PracticeBrandingBar.jsx";
import "../../../styles/PatientInboxPage.css";
import "../../../styles/PatientThreadsPage.css";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
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

  const grouped = useMemo(() => {
    const map = new Map();
    for (const thread of threads) {
      const key = thread.practice?.id || "unknown";
      const practiceName =
        thread.practice?.displayName || thread.practice?.practiceName || t.fromPractice;
      if (!map.has(key)) {
        map.set(key, { practiceName, branding: thread.practice, threads: [] });
      }
      map.get(key).threads.push(thread);
    }
    return [...map.values()];
  }, [threads, t.fromPractice]);

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
        <div aria-label={t.listCaption}>
          {grouped.map((group) => (
            <section
              key={group.practiceName}
              className="patient-threads__group"
              aria-labelledby={`practice-group-${group.practiceName.replace(/\s+/g, "-")}`}
            >
              <PracticeBrandingBar branding={group.branding} compact />
              <h2
                id={`practice-group-${group.practiceName.replace(/\s+/g, "-")}`}
                className="patient-threads__group-title"
              >
                {group.practiceName}
              </h2>
              <ul className="patient-threads__list">
                {group.threads.map((thread) => {
                  const statusText = threadStatusLabel(thread.status, t);
                  const statusAria = t.statusAria.replace("{status}", statusText);
                  const title = thread.subject?.trim() || t.noSubject;

                  return (
                    <li key={thread.id} className="patient-threads__item">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                          {title}
                        </h3>
                        <span
                          className={`patient-threads__status patient-threads__status--${thread.status}`}
                          aria-label={statusAria}
                        >
                          {statusText}
                          {thread.hasUnread ? ` · ${t.unreadBadge}` : ""}
                        </span>
                      </div>
                      <p className="patient-inbox__meta" style={{ margin: "0.5rem 0" }}>
                        {fmt(thread.updatedAt, language)}
                      </p>
                      <Link
                        className="patient-threads__btn patient-threads__btn--primary"
                        to={`/patient/messages/${encodeURIComponent(thread.id)}`}
                        aria-label={
                          thread.hasUnread
                            ? `${t.openThread} — ${t.unreadAria}`
                            : t.openThread
                        }
                      >
                        {t.openThread}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
