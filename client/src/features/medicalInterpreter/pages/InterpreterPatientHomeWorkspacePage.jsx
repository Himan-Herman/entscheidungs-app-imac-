import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_DRAFT,
} from "../constants.js";
import {
  clearAllInterpreterSessions,
  listSessions,
} from "../store/interpreterSessionStore.js";
import { getSessionDisplayTitle } from "../utils/sessionDisplayTitle.js";
import "../styles/MedicalInterpreter.css";

function buildCopy(language) {
  if (language === "de") {
    return {
      back: "Zurück zum Patientenbereich",
      title: "Dolmetscher neu aufgesetzt",
      intro:
        "Dieser Bereich startet jetzt auf einer frischen, einheitlichen Basis. Keine alten Oberflächen mehr, kein gemischtes Verhalten zwischen Browsern.",
      note:
        "Kommunikationshilfe nur für Live-Übersetzung, Transkription, Vorlesen, Dokumentation und PDF.",
      primary: "Neue Sitzung vorbereiten",
      secondary: "Aktive Sitzung fortsetzen",
      historyTitle: "Letzte Sitzungen",
      empty: "Noch keine gespeicherte Sitzung vorhanden.",
      clearAll: "Alle lokalen Sitzungen löschen",
      stepsTitle: "Neue Basis",
      steps: [
        "Eine Startseite für Patient:innen statt mehrerer alter Varianten.",
        "Klare Vorbereitung mit nur den nötigsten Angaben.",
        "Live-Gespräch und Dokumentation bleiben auf denselben Routen gebündelt.",
      ],
      reviewAction: "Prüfen",
      liveAction: "Live",
      activeBadge: "Aktiv",
      endedBadge: "Beendet",
    };
  }

  return {
    back: "Back to patient area",
    title: "Interpreter reset",
    intro:
      "This area now starts from a fresh, unified base. No old mixed surfaces and no browser-specific interpreter shells.",
    note:
      "Communication support only for live translation, transcription, spoken playback, documentation, and PDF.",
    primary: "Prepare new session",
    secondary: "Continue active session",
    historyTitle: "Recent sessions",
    empty: "No saved session yet.",
    clearAll: "Delete all local sessions",
    stepsTitle: "Fresh base",
    steps: [
      "One patient entry page instead of multiple old variants.",
      "A clean preparation step with only the necessary fields.",
      "Live conversation and documentation remain bundled on the same routes.",
    ],
    reviewAction: "Review",
    liveAction: "Live",
    activeBadge: "Active",
    endedBadge: "Ended",
  };
}

export default function InterpreterPatientHomeWorkspacePage() {
  const { language } = useLanguage();
  const t = useMedicalInterpreterMessages();
  const copy = useMemo(() => buildCopy(language), [language]);
  const [storeTick, setStoreTick] = useState(0);

  useEffect(() => {
    document.title = `${copy.title} | MedScoutX`;
  }, [copy.title]);

  const sessions = useMemo(() => {
    void storeTick;
    return listSessions();
  }, [storeTick]);

  const activeSession = useMemo(
    () =>
      sessions.find(
        (session) =>
          session.status === SESSION_STATUS_DRAFT ||
          session.status === SESSION_STATUS_ACTIVE,
      ) || null,
    [sessions],
  );

  return (
    <main className="medical-interpreter-page interp-root" id="main-content">
      <Link className="medical-interpreter-page__back" to="/patient">
        {copy.back}
      </Link>

      <section className="interpreter-reset__hero">
        <p className="interpreter-reset__eyebrow">MedScoutX Interpreter</p>
        <h1 className="medical-interpreter-page__title">{copy.title}</h1>
        <p className="medical-interpreter-page__intro">{copy.intro}</p>
        <p className="medical-interpreter-safety" role="note">
          {copy.note}
        </p>
      </section>

      <section className="interpreter-reset__grid" aria-labelledby="interp-reset-steps">
        <article className="interpreter-reset__card">
          <h2 id="interp-reset-steps" className="interpreter-reset__card-title">
            {copy.stepsTitle}
          </h2>
          <ul className="interpreter-reset__list">
            {copy.steps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="interpreter-reset__card">
          <h2 className="interpreter-reset__card-title">Workspace</h2>
          <div className="interpreter-reset__actions">
            <Link
              className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
              to="/patient/interpreter/setup?new=1"
            >
              {copy.primary}
            </Link>
            {activeSession ? (
              <Link
                className="medical-interpreter-page__nav-link"
                to={`/patient/interpreter/live?sessionId=${encodeURIComponent(activeSession.sessionId)}`}
              >
                {copy.secondary}
              </Link>
            ) : null}
            {sessions.length > 0 ? (
              <button
                type="button"
                className="medical-interpreter-page__nav-link interpreter-live__action-danger"
                onClick={() => {
                  clearAllInterpreterSessions();
                  setStoreTick((value) => value + 1);
                }}
              >
                {copy.clearAll}
              </button>
            ) : null}
          </div>
        </article>
      </section>

      <section className="interpreter-reset__history" aria-labelledby="interp-reset-history">
        <div className="interpreter-live-shell__conversation-head">
          <h2 id="interp-reset-history" className="interpreter-live-shell__section-title">
            {copy.historyTitle}
          </h2>
        </div>

        {sessions.length === 0 ? (
          <p className="interpreter-empty-state">{copy.empty}</p>
        ) : (
          <ol className="interpreter-reset__session-list">
            {sessions.slice(0, 6).map((session) => {
              const title = getSessionDisplayTitle(session, t, language);
              const patientLanguage =
                formatLanguageDisplayName(language, session.patientLanguage) ||
                session.patientLanguage;
              const doctorLanguage =
                formatLanguageDisplayName(language, session.doctorLanguage) ||
                session.doctorLanguage;
              const statusLabel =
                session.status === SESSION_STATUS_ACTIVE ||
                session.status === SESSION_STATUS_DRAFT
                  ? copy.activeBadge
                  : copy.endedBadge;

              return (
                <li key={session.sessionId} className="interpreter-reset__session-card">
                  <div className="interpreter-reset__session-top">
                    <strong>{title}</strong>
                    <span className="interpreter-reset__badge">{statusLabel}</span>
                  </div>
                  <p className="interpreter-reset__meta">
                    {patientLanguage} {"->"} {doctorLanguage}
                  </p>
                  <div className="interpreter-reset__actions interpreter-reset__actions--inline">
                    <Link
                      className="medical-interpreter-page__nav-link"
                      to={`/patient/interpreter/review?sessionId=${encodeURIComponent(session.sessionId)}`}
                    >
                      {copy.reviewAction}
                    </Link>
                    {(session.status === SESSION_STATUS_ACTIVE ||
                      session.status === SESSION_STATUS_DRAFT) && (
                      <Link
                        className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
                        to={`/patient/interpreter/live?sessionId=${encodeURIComponent(session.sessionId)}`}
                      >
                        {copy.liveAction}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
