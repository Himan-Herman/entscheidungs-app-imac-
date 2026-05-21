import { Link } from "react-router-dom";
import { isMedicalInterpreterClientEnabled } from "../config/isMedicalInterpreterEnabled.js";
import { useInterpreterServerStatus } from "../hooks/useInterpreterServerStatus.js";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import InterpreterErrorBoundary from "./InterpreterErrorBoundary.jsx";
import "../styles/MedicalInterpreter.css";

function DisabledShell({ t, message }) {
  return (
    <main className="medical-interpreter-disabled interp-root" id="main-content">
      <div className="medical-interpreter-disabled__card">
        <h1 className="medical-interpreter-disabled__title">
          {t.chrome.moduleTitle}
        </h1>
        <p className="medical-interpreter-disabled__text">{message}</p>
        <p className="medical-interpreter-safety" role="note">
          {t.safety.communicationOnly}
        </p>
      </div>
      <Link className="medical-interpreter-page__back" to="/patient">
        {t.chrome.backToHub}
      </Link>
    </main>
  );
}

export default function MedicalInterpreterFeatureGate({ children }) {
  const t = useMedicalInterpreterMessages();
  const server = useInterpreterServerStatus();
  const clientOn = isMedicalInterpreterClientEnabled();
  const serverOn = server.enabled === true;

  if (!clientOn && server.loading) {
    return (
      <main className="medical-interpreter-page interp-root" id="main-content" aria-busy="true">
        <p className="interpreter-empty-state" role="status">
          {t.languages.loadingDefaults}
        </p>
      </main>
    );
  }

  if (!clientOn && !serverOn) {
    return <DisabledShell t={t} message={t.empty.moduleDisabled} />;
  }

  if (clientOn && !server.loading && server.enabled === false) {
    return <DisabledShell t={t} message={t.empty.moduleDisabled} />;
  }

  return (
    <InterpreterErrorBoundary labels={t}>
      {children}
    </InterpreterErrorBoundary>
  );
}
