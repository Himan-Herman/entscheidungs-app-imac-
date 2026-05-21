import { useEffect } from "react";
import { Link } from "react-router-dom";
import InterpreterPracticeFeatureGate from "../components/InterpreterPracticeFeatureGate.jsx";
import { useMedicalInterpreterPracticeMessages } from "../hooks/useMedicalInterpreterPracticeMessages.js";
import {
  practiceInterpreterPath,
  usePracticeIdFromQuery,
} from "../utils/practiceContextQuery.js";
import "../styles/MedicalInterpreter.css";

function InterpreterPracticeHubContent() {
  const t = useMedicalInterpreterPracticeMessages();
  const practiceId = usePracticeIdFromQuery();

  useEffect(() => {
    document.title = t.hub.pageTitle;
  }, [t.hub.pageTitle]);

  const backHref = practiceInterpreterPath("/practice", practiceId);
  const dashboardHref = practiceInterpreterPath(
    "/practice/interpreter/dashboard",
    practiceId,
  );
  const invitesHref = practiceInterpreterPath(
    "/practice/interpreter/invites",
    practiceId,
  );

  return (
    <main className="medical-interpreter-page interp-root" id="main-content">
      <Link className="medical-interpreter-page__back" to={backHref}>
        {t.chrome.backToPractice}
      </Link>
      <h1 className="medical-interpreter-page__title">{t.hub.heading}</h1>
      <p className="medical-interpreter-page__intro">{t.hub.intro}</p>
      <p className="medical-interpreter-safety" role="note">
        {t.safety.communicationOnly}
      </p>
      <p className="interpreter-empty-state" role="status">
        {t.hub.placeholder}
      </p>
      <nav className="interpreter-home__primary-nav" aria-label={t.hub.openDashboard}>
        <Link
          className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
          to={dashboardHref}
        >
          {t.hub.openDashboard}
        </Link>
        <Link className="medical-interpreter-page__nav-link" to={invitesHref}>
          {t.hub.openInvites}
        </Link>
      </nav>
    </main>
  );
}

export default function InterpreterPracticeHubPage() {
  return (
    <InterpreterPracticeFeatureGate>
      <InterpreterPracticeHubContent />
    </InterpreterPracticeFeatureGate>
  );
}
