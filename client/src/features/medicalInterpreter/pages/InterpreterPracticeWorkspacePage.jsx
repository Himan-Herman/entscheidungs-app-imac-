import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import InterpreterPracticeFeatureGate from "../components/InterpreterPracticeFeatureGate.jsx";
import {
  practiceInterpreterPath,
  usePracticeIdFromQuery,
} from "../utils/practiceContextQuery.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import "../styles/MedicalInterpreter.css";

function buildCopy(language) {
  if (language === "de") {
    return {
      back: "Zurück zum Praxisbereich",
      title: "Praxis-Dolmetscher neu gestartet",
      intro:
        "Die alte Praxislandschaft mit Dashboard, Einladungen und separaten Sitzungsansichten wurde entfernt. Dieser Bereich wird jetzt auf derselben klaren Basis wie der Patienten-Dolmetscher neu aufgebaut.",
      note:
        "Damit gibt es nur noch einen Praxis-Einstieg statt mehrerer alter Varianten.",
      cardTitle: "Reset der Praxisoberfläche",
      bullets: [
        "Alte Unterseiten für Dashboard, Invites und Sitzungen sind aus dem sichtbaren Flow entfernt.",
        "Die Praxis startet künftig aus einem gemeinsamen Interpreter-Workspace.",
        "Der alte gemischte Interpreter-Stack wird nicht mehr parallel ausgespielt.",
      ],
    };
  }

  return {
    back: "Back to practice area",
    title: "Practice interpreter reset",
    intro:
      "The old practice area with dashboard, invites, and separate session views has been removed. This area is now being rebuilt on the same clean base as the patient interpreter.",
    note:
      "That leaves one practice entry point instead of several legacy variants.",
    cardTitle: "Practice surface reset",
    bullets: [
      "Legacy dashboard, invite, and session subpages were removed from the visible flow.",
      "The practice side will restart from one shared interpreter workspace.",
      "The old mixed interpreter stack is no longer exposed in parallel.",
    ],
  };
}

function InterpreterPracticeWorkspaceContent() {
  const { language } = useLanguage();
  const copy = useMemo(() => buildCopy(language), [language]);
  const practiceId = usePracticeIdFromQuery();
  const backHref = practiceInterpreterPath("/practice", practiceId);

  useEffect(() => {
    document.title = `${copy.title} | MedScoutX`;
  }, [copy.title]);

  return (
    <main className="medical-interpreter-page interp-root" id="main-content">
      <Link className="medical-interpreter-page__back" to={backHref}>
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

      <section className="interpreter-reset__grid">
        <article className="interpreter-reset__card">
          <h2 className="interpreter-reset__card-title">{copy.cardTitle}</h2>
          <ul className="interpreter-reset__list">
            {copy.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}

export default function InterpreterPracticeWorkspacePage() {
  return (
    <InterpreterPracticeFeatureGate>
      <InterpreterPracticeWorkspaceContent />
    </InterpreterPracticeFeatureGate>
  );
}
