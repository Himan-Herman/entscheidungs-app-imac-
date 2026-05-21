import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchInterpreterPracticeStatus } from "../api/interpreterPracticeApi.js";
import { isMedicalInterpreterB2bClientEnabled } from "../config/isMedicalInterpreterB2bEnabled.js";
import { useMedicalInterpreterPracticeMessages } from "../hooks/useMedicalInterpreterPracticeMessages.js";
import {
  practiceInterpreterPath,
  usePracticeIdFromQuery,
} from "../utils/practiceContextQuery.js";
import "../styles/MedicalInterpreter.css";

/**
 * B2B practice shell — separate from B2C MedicalInterpreterFeatureGate.
 * @param {{ children: import('react').ReactNode; requirePracticeId?: boolean }} props
 */
export default function InterpreterPracticeFeatureGate({
  children,
  requirePracticeId = true,
}) {
  const t = useMedicalInterpreterPracticeMessages();
  const practiceId = usePracticeIdFromQuery();
  const clientOn = isMedicalInterpreterB2bClientEnabled();
  const [server, setServer] = useState({
    loading: true,
    enabled: null,
    canView: null,
  });

  useEffect(() => {
    if (!clientOn) {
      setServer({ loading: false, enabled: false, canView: false });
      return undefined;
    }
    let cancelled = false;
    void fetchInterpreterPracticeStatus(
      practiceId ? { practiceId } : {},
    ).then((result) => {
      if (!cancelled) {
        setServer({
          loading: false,
          enabled: result.enabled === true,
          canView: result.canView !== false,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clientOn, practiceId]);

  const hubBackTo = practiceId
    ? practiceInterpreterPath("/practice", practiceId)
    : "/practice";

  if (!clientOn) {
    return (
      <main className="medical-interpreter-disabled interp-root" id="main-content">
        <div className="medical-interpreter-disabled__card">
          <h1 className="medical-interpreter-disabled__title">{t.chrome.moduleTitle}</h1>
          <p className="medical-interpreter-disabled__text">{t.empty.moduleDisabled}</p>
          <p className="medical-interpreter-safety" role="note">
            {t.safety.communicationOnly}
          </p>
        </div>
        <Link className="medical-interpreter-page__back" to="/practice">
          {t.chrome.backToPractice}
        </Link>
      </main>
    );
  }

  if (requirePracticeId && !practiceId) {
    return (
      <main className="medical-interpreter-page interp-root" id="main-content">
        <h1 className="medical-interpreter-page__title">{t.chrome.moduleTitle}</h1>
        <p className="interpreter-feedback interpreter-feedback--error" role="alert">
          {t.empty.missingPracticeContext}
        </p>
        <p className="medical-interpreter-safety" role="note">
          {t.safety.communicationOnly}
        </p>
        <Link className="medical-interpreter-page__back" to="/practice">
          {t.chrome.backToPractice}
        </Link>
      </main>
    );
  }

  if (server.loading) {
    return (
      <main className="medical-interpreter-page interp-root" id="main-content" aria-busy="true">
        <p className="interpreter-empty-state" role="status">
          {t.dashboard.placeholder}
        </p>
      </main>
    );
  }

  if (!server.enabled) {
    return (
      <main className="medical-interpreter-disabled interp-root" id="main-content">
        <div className="medical-interpreter-disabled__card">
          <h1 className="medical-interpreter-disabled__title">{t.chrome.moduleTitle}</h1>
          <p className="medical-interpreter-disabled__text">{t.empty.serverDisabled}</p>
        </div>
        <Link className="medical-interpreter-page__back" to={hubBackTo}>
          {t.chrome.backToPractice}
        </Link>
      </main>
    );
  }

  if (practiceId && server.canView === false) {
    return (
      <main className="medical-interpreter-page interp-root" id="main-content">
        <h1 className="medical-interpreter-page__title">{t.chrome.moduleTitle}</h1>
        <p className="interpreter-feedback interpreter-feedback--error" role="alert">
          {t.empty.permissionUnavailable}
        </p>
        <p className="medical-interpreter-safety" role="note">
          {t.safety.communicationOnly}
        </p>
        <Link className="medical-interpreter-page__back" to={hubBackTo}>
          {t.chrome.backToPractice}
        </Link>
      </main>
    );
  }

  return children;
}
