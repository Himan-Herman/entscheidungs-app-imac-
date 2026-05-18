import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pill } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import VisitMedicationCard from "../components/VisitMedicationCard.jsx";
import {
  fetchPatientMedicationSessions,
  fetchPatientSessionMedications,
} from "../api/visitMedicationsApi.js";
import "../styles/VisitMedications.css";

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
    });
  } catch {
    return "—";
  }
}

export default function PatientVisitMedicationsPage() {
  const { sessionId } = useParams();
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.visitMedications ?? getMessages("en").visitMedications;
  }, [language]);

  const [sessions, setSessions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchPatientMedicationSessions();
      setSessions(list);
    } catch {
      setError(t.loadError);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  const loadDetail = useCallback(
    async (id) => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchPatientSessionMedications(id, { markViewed: true });
        setDetail(data);
      } catch {
        setError(t.loadError);
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [t.loadError],
  );

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    if (sessionId) {
      void loadDetail(sessionId);
    } else {
      void loadList();
    }
  }, [sessionId, loadDetail, loadList]);

  if (sessionId && detail) {
    return (
      <div className="vm-page">
        <nav className="vm-page__nav">
          <Link to="/pre-visit/medications" className="vm-page__back">
            <ArrowLeft size={18} aria-hidden />
            {t.backList}
          </Link>
        </nav>
        <header className="vm-page__hero">
          <Pill size={28} aria-hidden className="vm-page__hero-icon" />
          <h1 className="vm-page__title">
            {detail.session?.practiceName || t.patientHeading}
          </h1>
          <p className="vm-page__sub">
            {t.visitDate}: {fmt(detail.session?.createdAt, language)}
          </p>
        </header>
        <p className="vm-page__disclaimer" role="note">
          {t.patientDisclaimer}
        </p>
        <div className="vm-page__list">
          {detail.entries?.map((entry) => (
            <VisitMedicationCard key={entry.id} entry={entry} t={t} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="vm-page">
      <nav className="vm-page__nav">
        <Link to="/patient" className="vm-page__back">
          <ArrowLeft size={18} aria-hidden />
          {t.backPatientHub}
        </Link>
      </nav>
      <header className="vm-page__hero">
        <Pill size={28} aria-hidden className="vm-page__hero-icon" />
        <h1 className="vm-page__title">{t.patientHeading}</h1>
        <p className="vm-page__sub">{t.patientSub}</p>
      </header>
      <p className="vm-page__disclaimer" role="note">
        {t.patientDisclaimer}
      </p>

      {error ? (
        <p className="vm-alert vm-alert--error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="vm-status" role="status">
          …
        </p>
      ) : sessions.length === 0 ? (
        <section className="vm-empty" aria-labelledby="vm-empty-title">
          <h2 id="vm-empty-title" className="vm-empty__title">
            {t.emptyTitle}
          </h2>
          <p>{t.emptyHint}</p>
          <p>
            <Link to="/pre-visit/follow-ups" className="vm-link">
              {getMessages(language).preVisit?.followUps?.navTitle ?? "Rückfragen"}
            </Link>
          </p>
        </section>
      ) : (
        <ul className="vm-session-list">
          {sessions.map((s) => (
            <li key={s.sessionId}>
              <Link
                to={`/pre-visit/medications/${encodeURIComponent(s.sessionId)}`}
                className="vm-session-card"
              >
                <div className="vm-session-card__top">
                  <strong>{s.practiceName || t.practiceLabel}</strong>
                  {s.hasUnviewed ? (
                    <span className="vm-badge">{t.newBadge}</span>
                  ) : null}
                </div>
                <p className="vm-session-card__meta">
                  {t.visitDate}: {fmt(s.sessionCreatedAt || s.publishedAt, language)}
                </p>
                <p className="vm-session-card__meta">
                  {t.entryCount.replace("{count}", String(s.entryCount))}
                </p>
                <span className="vm-session-card__cta">{t.openSession}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
