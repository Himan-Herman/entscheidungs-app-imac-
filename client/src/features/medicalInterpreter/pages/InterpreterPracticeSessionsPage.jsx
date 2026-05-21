import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import InterpreterPracticeFeatureGate from "../components/InterpreterPracticeFeatureGate.jsx";
import { fetchPracticeInterpreterSessions } from "../api/interpreterPracticeApi.js";
import { useMedicalInterpreterPracticeMessages } from "../hooks/useMedicalInterpreterPracticeMessages.js";
import {
  practiceInterpreterPath,
  usePracticeIdFromQuery,
} from "../utils/practiceContextQuery.js";
import "../styles/MedicalInterpreter.css";

function InterpreterPracticeSessionsContent() {
  const t = useMedicalInterpreterPracticeMessages();
  const practiceId = usePracticeIdFromQuery();
  const [load, setLoad] = useState({ loading: true, sessions: [], error: null });

  const dashboardHref = practiceInterpreterPath(
    "/practice/interpreter/dashboard",
    practiceId,
  );

  const reload = useCallback(async () => {
    setLoad((s) => ({ ...s, loading: true }));
    const result = await fetchPracticeInterpreterSessions({ practiceId });
    setLoad({
      loading: false,
      sessions: result.sessions || [],
      error: result.ok ? null : result.error,
    });
  }, [practiceId]);

  useEffect(() => {
    document.title = t.sessions.pageTitle;
  }, [t.sessions.pageTitle]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="medical-interpreter-page interp-practice-sessions interp-root" id="main-content">
      <nav className="interp-practice-dash__nav" aria-label={t.sessions.navAria}>
        <Link className="medical-interpreter-page__back" to={dashboardHref}>
          {t.sessions.backToDashboard}
        </Link>
      </nav>
      <h1 className="medical-interpreter-page__title">{t.sessions.heading}</h1>
      <p className="medical-interpreter-page__intro">{t.sessions.intro}</p>
      <p className="medical-interpreter-safety" role="note">
        {t.safety.communicationOnly}
      </p>
      {load.loading ? (
        <p className="interpreter-empty-state" role="status" aria-live="polite">
          {t.sessions.loading}
        </p>
      ) : null}
      {!load.loading && load.sessions.length === 0 ? (
        <p className="interpreter-empty-state" role="status">
          {t.sessions.empty}
        </p>
      ) : null}
      {!load.loading && load.sessions.length > 0 ? (
        <ul className="interp-practice-sessions__list">
          {load.sessions.map((row) => {
            const href = practiceInterpreterPath(
              `/practice/interpreter/sessions/${row.id}`,
              practiceId,
            );
            const langs =
              row.patientLanguage && row.doctorLanguage
                ? `${row.patientLanguage} ↔ ${row.doctorLanguage}`
                : t.sessions.languageUnknown;
            return (
              <li key={row.id}>
                <Link className="interp-practice-sessions__link" to={href}>
                  <span className="interp-practice-sessions__langs">{langs}</span>
                  {row.consentGrantedAt ? (
                    <time className="interp-practice-sessions__date" dateTime={row.consentGrantedAt}>
                      {new Date(row.consentGrantedAt).toLocaleString()}
                    </time>
                  ) : null}
                  <span className="interp-practice-sessions__badge" role="status">
                    {t.sessions.sharedBadge}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}

export default function InterpreterPracticeSessionsPage() {
  return (
    <InterpreterPracticeFeatureGate>
      <InterpreterPracticeSessionsContent />
    </InterpreterPracticeFeatureGate>
  );
}
