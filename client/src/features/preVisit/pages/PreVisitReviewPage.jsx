import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import {
  PRE_VISIT_QUESTION_STEPS,
  pickLocalized,
} from "../constants/questionFlow.js";
import {
  clearAnswerField,
  clearFullSession,
  loadPreVisitSession,
  resetSessionKeepLanguage,
  setSessionStepIndex,
} from "../constants/preVisitSession.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitReviewPage.css";

const ui = {
  de: {
    title: "Übersicht Ihrer Angaben",
    intro:
      "So werden Ihre Einträge später für die ärztliche Vorbereitung verwendet. Sie können noch Anpassungen vornehmen.",
    empty: "nicht angegeben",
    edit: "Bearbeiten",
    clearField: "Angabe löschen",
    trustBeforeActions:
      "Sie können Ihre Angaben vor dem Erstellen des Dokuments jederzeit prüfen, bearbeiten oder löschen.",
    newSession: "Neue Sitzung starten",
    wipeSession: "Sitzung vollständig löschen",
    prepareDocument: "Dokument vorbereiten",
  },
  en: {
    title: "Summary of your entries",
    intro:
      "This is how your entries will be used to prepare for your visit. You can still make changes.",
    empty: "not specified",
    edit: "Edit",
    clearField: "Remove entry",
    trustBeforeActions:
      "You can review, edit or delete your information at any time before creating the document.",
    newSession: "Start new session",
    wipeSession: "Delete session completely",
    prepareDocument: "Prepare document",
  },
};

export default function PreVisitReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const t = ui[language] ?? ui.de;

  const [session, setSession] = useState(() => loadPreVisitSession());

  useEffect(() => {
    const s = loadPreVisitSession();
    setSession(s);
    if (!s?.answers) {
      navigate("/pre-visit", { replace: true });
    }
  }, [location.pathname, location.key, navigate]);

  useEffect(() => {
    document.title =
      language === "en"
        ? "MedScoutX — Pre-visit summary"
        : "MedScoutX — Übersicht";
  }, [language]);

  if (!session?.answers) {
    return null;
  }

  const lang = session.patientLanguage || "de";

  function handleEditStep(stepIndex) {
    setSessionStepIndex(stepIndex);
    navigate("/pre-visit/chat");
  }

  function handleClearField(fieldKey) {
    clearAnswerField(fieldKey);
    setSession(loadPreVisitSession());
  }

  function handleNewSession() {
    resetSessionKeepLanguage();
    navigate("/pre-visit/chat");
  }

  function handleWipeSession() {
    clearFullSession();
    navigate("/pre-visit");
  }

  return (
    <div className="pre-visit-review">
      <div className="pre-visit-review__inner">
        <PreVisitModuleChrome />
        <article className="pre-visit-review__card">
          <h1 className="pre-visit-review__title">{t.title}</h1>

          <div className="pre-visit-review__prepare-wrap">
            <Link
              className="pre-visit-review__prepare-btn"
              to="/pre-visit/document"
              aria-describedby="previsit-review-intro"
            >
              {t.prepareDocument}
            </Link>
          </div>

          <p id="previsit-review-intro" className="pre-visit-review__intro">
            {t.intro}
          </p>

          <dl className="pre-visit-review__list">
            {PRE_VISIT_QUESTION_STEPS.map((step, stepIndex) => {
              const text = session.answers[step.key] ?? "";
              const heading = pickLocalized(step.title, lang);
              const isEmpty = !String(text).trim();

              return (
                <div key={step.key} className="pre-visit-review__item">
                  <dt className="pre-visit-review__item-title">{heading}</dt>
                  <dd className="pre-visit-review__item-dd">
                    <div className="pre-visit-review__item-tools">
                      <button
                        type="button"
                        className="pre-visit-review__tool pre-visit-review__tool--edit"
                        onClick={() => handleEditStep(stepIndex)}
                      >
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        className="pre-visit-review__tool pre-visit-review__tool--clear"
                        onClick={() => handleClearField(step.key)}
                      >
                        {t.clearField}
                      </button>
                    </div>
                    <p
                      className={`pre-visit-review__item-body ${
                        isEmpty ? "pre-visit-review__item-body--empty" : ""
                      }`}
                    >
                      {isEmpty ? t.empty : text}
                    </p>
                  </dd>
                </div>
              );
            })}
          </dl>

          <p className="pre-visit-review__trust">{t.trustBeforeActions}</p>

          <div className="pre-visit-review__session-actions">
            <button
              type="button"
              className="pre-visit-review__session-btn pre-visit-review__session-btn--secondary"
              onClick={handleNewSession}
            >
              {t.newSession}
            </button>
            <button
              type="button"
              className="pre-visit-review__session-btn pre-visit-review__session-btn--outline"
              onClick={handleWipeSession}
            >
              {t.wipeSession}
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
