import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations/index.js";
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

export default function PreVisitReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).preVisit.review, [language]);

  const [session, setSession] = useState(() => loadPreVisitSession());

  useEffect(() => {
    const s = loadPreVisitSession();
    setSession(s);
    if (!s?.answers) {
      navigate("/pre-visit", { replace: true });
    }
  }, [location.pathname, location.key, navigate]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

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
