import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import {
  PRE_VISIT_QUESTION_STEPS,
  pickLocalized,
} from "../constants/questionFlow.js";
import {
  buildInitialSession,
  loadPreVisitSession,
  PREVISIT_LOCALE_STORAGE_KEY,
  savePreVisitSession,
} from "../constants/preVisitSession.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitChatPage.css";

function readLocaleKey() {
  try {
    return sessionStorage.getItem(PREVISIT_LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Neutral demo copy for local development only (non-diagnostic). */
const PREVISIT_DEMO_ANSWERS = {
  appointmentReason:
    "Vorbereitung auf einen Arzttermin wegen wiederkehrender Beschwerden.",
  symptomsOwnWords:
    "Ich habe seit einiger Zeit wiederkehrende Beschwerden und möchte diese beim Arzt strukturiert besprechen.",
  onsetAndCourse:
    "Die Beschwerden bestehen seit etwa zwei Wochen. Der Verlauf ist wechselnd.",
  medications: "Keine regelmäßigen Medikamente angegeben.",
  preExistingConditions: "Keine bekannten Vorerkrankungen angegeben.",
  relevantDocuments: "Keine Dokumente angegeben.",
  patientQuestions:
    "Welche Untersuchungen sind sinnvoll? Welche Informationen sollte ich weiter beobachten?",
};

const devUi = {
  de: {
    insertDemo: "Demo-Angaben einfügen",
    devOnlyNote: "Nur für lokale Entwicklung sichtbar.",
  },
  en: {
    insertDemo: "Insert demo information",
    devOnlyNote: "Visible only during local development.",
  },
};

const ui = {
  de: {
    progress: (n, total) => `Schritt ${n} von ${total}`,
    answerPlaceholder: "Ihre Angaben …",
    next: "Weiter",
    back: "Zurück",
    changeLanguage: "Sprache der Angaben ändern",
  },
  en: {
    progress: (n, total) => `Step ${n} of ${total}`,
    answerPlaceholder: "Your entry…",
    next: "Continue",
    back: "Back",
    changeLanguage: "Change entry language",
  },
};

export default function PreVisitChatPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tUi = ui[language] ?? ui.de;

  const [session, setSession] = useState(() =>
    buildInitialSession(readLocaleKey() || "de")
  );

  useEffect(() => {
    if (!readLocaleKey()) {
      navigate("/pre-visit", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const loc = readLocaleKey();
    if (loc) {
      setSession((s) =>
        s.patientLanguage === loc ? s : { ...s, patientLanguage: loc }
      );
    }
  }, []);

  useEffect(() => {
    savePreVisitSession(session);
  }, [session]);

  useEffect(() => {
    document.title =
      language === "en"
        ? "MedScoutX — Pre-visit intake"
        : "MedScoutX — Arztgespräch vorbereiten";
  }, [language]);

  const total = PRE_VISIT_QUESTION_STEPS.length;
  const stepIndex = Math.min(
    Math.max(0, session.stepIndex),
    total - 1
  );
  const step = PRE_VISIT_QUESTION_STEPS[stepIndex];
  const currentValue = session.answers[step.key] ?? "";

  function setAnswer(value) {
    setSession((prev) => ({
      ...prev,
      patientLanguage: prev.patientLanguage || readLocaleKey() || "de",
      answers: {
        ...prev.answers,
        [step.key]: value,
      },
    }));
  }

  function goNext() {
    if (stepIndex >= total - 1) {
      navigate("/pre-visit/review");
      return;
    }
    setSession((prev) => ({
      ...prev,
      stepIndex: stepIndex + 1,
    }));
  }

  function goBack() {
    if (stepIndex <= 0) {
      navigate("/pre-visit");
      return;
    }
    setSession((prev) => ({
      ...prev,
      stepIndex: stepIndex - 1,
    }));
  }

  function insertDemoAndGoToReview() {
    const loc = readLocaleKey() || "de";
    const prev = loadPreVisitSession();
    const patientLanguage = prev?.patientLanguage || loc;
    const completedStep = PRE_VISIT_QUESTION_STEPS.length - 1;
    const next = {
      ...(prev || {
        patientLanguage: loc,
        answers: {},
        stepIndex: 0,
      }),
      patientLanguage,
      answers: { ...PREVISIT_DEMO_ANSWERS },
      stepIndex: completedStep,
    };
    savePreVisitSession(next);
    navigate("/pre-visit/review");
  }

  const title = pickLocalized(step.title, session.patientLanguage);
  const explanation = pickLocalized(
    step.explanation,
    session.patientLanguage
  );
  const progressNum = stepIndex + 1;
  const progressPct = (progressNum / total) * 100;

  return (
    <div className="pre-visit-chat">
      <div className="pre-visit-chat__inner">
        <PreVisitModuleChrome />

        <div className="pre-visit-chat__progress-wrap">
          <p
            className="pre-visit-chat__progress-label"
            id="previsit-progress-label"
          >
            {tUi.progress(progressNum, total)}
          </p>
          <div
            className="pre-visit-chat__progress-track"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={progressNum}
            aria-labelledby="previsit-progress-label"
          >
            <div
              className="pre-visit-chat__progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <article className="pre-visit-chat__card">
          <p className="pre-visit-chat__section-label">
            {language === "en" ? "Question" : "Frage"}
          </p>
          <h1 className="pre-visit-chat__title">{title}</h1>
          <p className="pre-visit-chat__explanation">{explanation}</p>

          <div className="pre-visit-chat__field">
            <label
              className="pre-visit-chat__textarea-label"
              htmlFor={`previsit-field-${step.key}`}
            >
              {language === "en" ? "Your answer" : "Ihre Antwort"}
            </label>
            <textarea
              id={`previsit-field-${step.key}`}
              className="pre-visit-chat__textarea"
              value={currentValue}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={tUi.answerPlaceholder}
              rows={6}
              autoComplete="off"
            />
          </div>

          <div className="pre-visit-chat__actions">
            <button
              type="button"
              className="pre-visit-chat__btn pre-visit-chat__btn--secondary"
              onClick={goBack}
            >
              {tUi.back}
            </button>
            <button
              type="button"
              className="pre-visit-chat__btn pre-visit-chat__btn--primary"
              onClick={goNext}
            >
              {tUi.next}
            </button>
          </div>
        </article>

        {import.meta.env.DEV ? (
          <div className="pre-visit-chat__dev-demo">
            <button
              type="button"
              className="pre-visit-chat__btn pre-visit-chat__btn--demo"
              onClick={insertDemoAndGoToReview}
            >
              {devUi[language]?.insertDemo ?? devUi.de.insertDemo}
            </button>
            <p className="pre-visit-chat__dev-note">
              {devUi[language]?.devOnlyNote ?? devUi.de.devOnlyNote}
            </p>
          </div>
        ) : null}

        <Link className="pre-visit-chat__link" to="/pre-visit">
          {tUi.changeLanguage}
        </Link>
      </div>
    </div>
  );
}
