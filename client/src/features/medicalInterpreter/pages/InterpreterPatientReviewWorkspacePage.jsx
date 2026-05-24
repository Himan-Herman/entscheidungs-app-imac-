import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ENDED,
} from "../constants.js";
import {
  deleteSession,
  endSession,
  getCurrentSession,
  getSession,
  setCurrentSessionId,
} from "../store/interpreterSessionStore.js";
import { downloadInterpreterSessionPdf } from "../pdf/generateInterpreterSessionPdf.js";
import { getSessionDisplayTitle } from "../utils/sessionDisplayTitle.js";
import "../styles/MedicalInterpreter.css";

function buildCopy(language) {
  if (language === "de") {
    return {
      back: "Zurück zur Dolmetscher-Startseite",
      title: "Sitzung prüfen",
      intro:
        "Die alte Review-Landschaft wurde reduziert. Hier bleibt nur die klare Gesprächsdokumentation mit Weiterführen, Beenden, Löschen und PDF.",
      empty: "Keine Sitzung gefunden.",
      continue: "Weiter ins Live-Gespräch",
      end: "Gespräch beenden",
      export: "PDF herunterladen",
      delete: "Sitzung löschen",
      timeline: "Gesprächsverlauf",
      patient: "Patient",
      doctor: "Arzt / Praxis",
      original: "Original",
      translation: "Übersetzung",
    };
  }

  return {
    back: "Back to interpreter home",
    title: "Review session",
    intro:
      "The old review area was reduced. This page keeps only the clear conversation record with continue, end, delete, and PDF.",
    empty: "No session found.",
    continue: "Return to live conversation",
    end: "End conversation",
    export: "Download PDF",
    delete: "Delete session",
    timeline: "Conversation record",
    patient: "Patient",
    doctor: "Doctor / practice",
    original: "Original",
    translation: "Translation",
  };
}

export default function InterpreterPatientReviewWorkspacePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMedicalInterpreterMessages();
  const copy = useMemo(() => buildCopy(language), [language]);
  const [searchParams] = useSearchParams();
  const [storeTick, setStoreTick] = useState(0);
  const sessionId = searchParams.get("sessionId")?.trim() || "";

  const session = useMemo(() => {
    void storeTick;
    return sessionId ? getSession(sessionId) : getCurrentSession();
  }, [sessionId, storeTick]);

  useEffect(() => {
    document.title = `${copy.title} | MedScoutX`;
  }, [copy.title]);

  if (!session) {
    return (
      <main className="medical-interpreter-page interp-root" id="main-content">
        <Link className="medical-interpreter-page__back" to="/patient/interpreter">
          {copy.back}
        </Link>
        <h1 className="medical-interpreter-page__title">{copy.title}</h1>
        <p className="interpreter-empty-state">{copy.empty}</p>
      </main>
    );
  }

  const patientLanguage =
    formatLanguageDisplayName(language, session.patientLanguage) || session.patientLanguage;
  const doctorLanguage =
    formatLanguageDisplayName(language, session.doctorLanguage) || session.doctorLanguage;
  const title = getSessionDisplayTitle(session, t, language);
  const canContinue =
    session.status === SESSION_STATUS_ACTIVE || session.status === SESSION_STATUS_DRAFT;

  return (
    <main className="medical-interpreter-page interp-root" id="main-content">
      <Link className="medical-interpreter-page__back" to="/patient/interpreter">
        {copy.back}
      </Link>

      <section className="interpreter-reset__hero">
        <p className="interpreter-reset__eyebrow">MedScoutX Interpreter</p>
        <h1 className="medical-interpreter-page__title">{copy.title}</h1>
        <p className="medical-interpreter-page__intro">{copy.intro}</p>
      </section>

      <section className="interpreter-reset__grid">
        <article className="interpreter-reset__card">
          <h2 className="interpreter-reset__card-title">{title}</h2>
          <p className="interpreter-reset__meta">
            {patientLanguage} {"->"} {doctorLanguage}
          </p>
          <p className="interpreter-reset__meta">
            {session.patientName || "-"}
          </p>
          <div className="interpreter-reset__actions">
            {canContinue ? (
              <button
                type="button"
                className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
                onClick={() => {
                  setCurrentSessionId(session.sessionId);
                  navigate(`/patient/interpreter/live?sessionId=${encodeURIComponent(session.sessionId)}`);
                }}
              >
                {copy.continue}
              </button>
            ) : null}
            {session.status !== SESSION_STATUS_ENDED ? (
              <button
                type="button"
                className="medical-interpreter-page__nav-link"
                onClick={() => {
                  endSession(session.sessionId, null, language);
                  setStoreTick((value) => value + 1);
                }}
              >
                {copy.end}
              </button>
            ) : null}
              <button
                type="button"
                className="medical-interpreter-page__nav-link"
                onClick={() => {
                  downloadInterpreterSessionPdf(session, title, t);
                }}
                disabled={(session.turns?.length || 0) === 0}
              >
              {copy.export}
            </button>
            <button
              type="button"
              className="medical-interpreter-page__nav-link interpreter-live__action-danger"
              onClick={() => {
                if (!window.confirm(copy.delete)) return;
                deleteSession(session.sessionId);
                navigate("/patient/interpreter", { replace: true });
              }}
            >
              {copy.delete}
            </button>
          </div>
        </article>
      </section>

      <section className="interpreter-live-shell__conversation" aria-labelledby="interp-reset-turns">
        <div className="interpreter-live-shell__conversation-head">
          <h2 id="interp-reset-turns" className="interpreter-live-shell__section-title">
            {copy.timeline}
          </h2>
        </div>

        {(session.turns?.length || 0) === 0 ? (
          <p className="interpreter-empty-state">{copy.empty}</p>
        ) : (
          <ol className="interpreter-reset__turn-list">
            {session.turns.map((turn) => (
              <li key={turn.turnId} className="interpreter-reset__turn-card">
                <div className="interpreter-reset__turn-top">
                  <strong>
                    {turn.speaker === "doctor" ? copy.doctor : copy.patient}
                  </strong>
                  <span className="interpreter-reset__badge">{turn.status}</span>
                </div>
                <div className="interpreter-reset__turn-block">
                  <p className="interpreter-reset__turn-label">{copy.original}</p>
                  <p className="interpreter-reset__turn-text">{turn.originalTranscript || turn.originalText}</p>
                </div>
                <div className="interpreter-reset__turn-block">
                  <p className="interpreter-reset__turn-label">{copy.translation}</p>
                  <p className="interpreter-reset__turn-text">{turn.translatedText || "-"}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
