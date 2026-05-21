import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import "../styles/MedicalInterpreter.css";

/**
 * Shared placeholder shell — purpose + safety strip only (Phase 1.4).
 */
export default function InterpreterPlaceholderLayout({
  pageTitle,
  heading,
  intro,
  backTo = "/patient",
  backLabel,
  children,
}) {
  const t = useMedicalInterpreterMessages();

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <main className="medical-interpreter-page interp-root" id="main-content">
      <Link className="medical-interpreter-page__back" to={backTo}>
        {backLabel ?? t.chrome.backToHub}
      </Link>
      <h1 className="medical-interpreter-page__title">{heading}</h1>
      {intro ? <p className="medical-interpreter-page__intro">{intro}</p> : null}
      <p className="medical-interpreter-safety" role="note">
        {t.safety.strip}
      </p>
      {children}
    </main>
  );
}
