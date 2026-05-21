import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import InterpreterPracticeFeatureGate from "../components/InterpreterPracticeFeatureGate.jsx";
import { fetchPracticeInterpreterSessionDetail } from "../api/interpreterPracticeApi.js";
import { useMedicalInterpreterPracticeMessages } from "../hooks/useMedicalInterpreterPracticeMessages.js";
import {
  practiceInterpreterPath,
  usePracticeIdFromQuery,
} from "../utils/practiceContextQuery.js";
import "../styles/MedicalInterpreter.css";

function InterpreterPracticeSessionDetailContent() {
  const { id: linkId } = useParams();
  const t = useMedicalInterpreterPracticeMessages();
  const practiceId = usePracticeIdFromQuery();
  const [load, setLoad] = useState({ loading: true, session: null, error: null });

  const listHref = practiceInterpreterPath(
    "/practice/interpreter/sessions",
    practiceId,
  );

  useEffect(() => {
    document.title = t.sessionDetail.pageTitle;
  }, [t.sessionDetail.pageTitle]);

  useEffect(() => {
    let cancelled = false;
    void fetchPracticeInterpreterSessionDetail({ practiceId, linkId }).then((result) => {
      if (cancelled) return;
      setLoad({
        loading: false,
        session: result.session || null,
        error: result.ok ? null : result.error || result.message,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, linkId]);

  const turns = useMemo(() => {
    const conv = load.session?.conversation;
    return Array.isArray(conv?.turns) ? conv.turns : [];
  }, [load.session]);

  return (
    <main
      className="medical-interpreter-page interp-practice-session-detail interp-root"
      id="main-content"
    >
      <nav className="interp-practice-dash__nav" aria-label={t.sessionDetail.navAria}>
        <Link className="medical-interpreter-page__back" to={listHref}>
          {t.sessionDetail.backToList}
        </Link>
      </nav>
      <h1 className="medical-interpreter-page__title">{t.sessionDetail.heading}</h1>
      <p className="interp-practice-session-detail__label" role="note">
        {load.session?.documentationLabel || t.sessionDetail.documentationLabel}
      </p>
      <p className="medical-interpreter-safety" role="note">
        {load.session?.communicationNotice || t.safety.communicationOnly}
      </p>
      {load.session?.verificationNotice ? (
        <p className="interp-practice-session-detail__verify" role="note">
          {load.session.verificationNotice}
        </p>
      ) : null}
      {load.loading ? (
        <p className="interpreter-empty-state" role="status" aria-live="polite">
          {t.sessionDetail.loading}
        </p>
      ) : null}
      {!load.loading && load.error ? (
        <p className="interpreter-empty-state" role="alert">
          {t.sessionDetail.loadError}
        </p>
      ) : null}
      {!load.loading && load.session ? (
        <section aria-labelledby="interp-practice-turns-heading">
          <h2 id="interp-practice-turns-heading" className="interp-practice-dash__section-title">
            {t.sessionDetail.turnsHeading}
          </h2>
          <ol className="interp-practice-session-detail__turns">
            {turns.map((turn, index) => (
              <li key={turn.turnId || index} className="interp-practice-session-detail__turn">
                <p className="interp-practice-session-detail__speaker">
                  {turn.speaker === "doctor"
                    ? t.sessionDetail.speakerDoctor
                    : t.sessionDetail.speakerPatient}
                </p>
                <p className="interp-practice-session-detail__original">{turn.originalText}</p>
                {turn.translatedText ? (
                  <p className="interp-practice-session-detail__translated">
                    {turn.translatedText}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}

export default function InterpreterPracticeSessionDetailPage() {
  return (
    <InterpreterPracticeFeatureGate>
      <InterpreterPracticeSessionDetailContent />
    </InterpreterPracticeFeatureGate>
  );
}
