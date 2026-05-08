import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations/index.js";
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
import PreVisitAudioToolbar from "../components/PreVisitAudioToolbar.jsx";
import SymptomsAdaptivePanel from "../components/SymptomsAdaptivePanel.jsx";
import {
  createEmptySymptomsIntakeSlice,
  isAdaptiveCategory,
  shouldUseLegacySymptomsEditor,
} from "../engine/symptomsAdaptiveEngine.js";
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

function progressFromTemplate(template, current, total) {
  return template
    .replace("{{current}}", String(current))
    .replace("{{total}}", String(total));
}

export default function PreVisitChatPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tUi = useMemo(() => getMessages(language).preVisit.chat, [language]);

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
    document.title = tUi.pageTitle;
  }, [tUi.pageTitle]);

  const total = PRE_VISIT_QUESTION_STEPS.length;
  const stepIndex = Math.min(Math.max(0, session.stepIndex), total - 1);
  const step = PRE_VISIT_QUESTION_STEPS[stepIndex];
  const currentValue = session.answers[step.key] ?? "";

  const useAdaptiveSymptoms =
    isAdaptiveCategory(step.key) && !shouldUseLegacySymptomsEditor(session);

  const legacySymptomsEditor = shouldUseLegacySymptomsEditor(session);

  useEffect(() => {
    if (step.key !== "symptomsOwnWords") return;
    if (legacySymptomsEditor) return;
    if (session.intakeV1?.symptomsOwnWords) return;
    setSession((prev) => ({
      ...prev,
      intakeV1: {
        schemaVersion: 1,
        ...prev.intakeV1,
        symptomsOwnWords: createEmptySymptomsIntakeSlice(),
      },
    }));
  }, [
    step.key,
    legacySymptomsEditor,
    session.intakeV1?.symptomsOwnWords,
    session.answers?.symptomsOwnWords,
  ]);

  const [symptomsPanelBusy, setSymptomsPanelBusy] = useState(false);
  const adaptivePanelRef = useRef(null);

  const handleSymptomsBusy = useCallback((busy) => {
    setSymptomsPanelBusy(Boolean(busy));
  }, []);

  useEffect(() => {
    if (!useAdaptiveSymptoms) setSymptomsPanelBusy(false);
  }, [useAdaptiveSymptoms]);

  const handleSymptomsAdaptiveFinished = useCallback(
    (compiled) => {
      setSession((prev) => {
        const totalSteps = PRE_VISIT_QUESTION_STEPS.length;
        const idx = Math.min(Math.max(0, prev.stepIndex), totalSteps - 1);
        const atLast = idx >= totalSteps - 1;
        const nextIdx = atLast ? idx : idx + 1;
        if (atLast) {
          queueMicrotask(() => navigate("/pre-visit/review"));
        }
        return {
          ...prev,
          answers: { ...prev.answers, symptomsOwnWords: compiled },
          intakeV1: {
            schemaVersion: 1,
            ...prev.intakeV1,
            symptomsOwnWords: {
              ...(prev.intakeV1?.symptomsOwnWords ||
                createEmptySymptomsIntakeSlice()),
              status: "complete",
              currentQuestion: null,
            },
          },
          stepIndex: nextIdx,
        };
      });
    },
    [navigate]
  );

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

  const speakText = useMemo(() => {
    const parts = [title, explanation];
    if (useAdaptiveSymptoms) {
      const q = String(
        session.intakeV1?.symptomsOwnWords?.currentQuestion || ""
      ).trim();
      if (q) parts.push(q);
    }
    return parts.filter(Boolean).join("\n\n").slice(0, 1200);
  }, [
    title,
    explanation,
    useAdaptiveSymptoms,
    session.intakeV1?.symptomsOwnWords?.currentQuestion,
  ]);

  const appendTranscript = useCallback(
    (snippet) => {
      const add = String(snippet || "").trim();
      if (!add) return;
      if (useAdaptiveSymptoms) {
        adaptivePanelRef.current?.appendDictatedText?.(add);
        return;
      }
      setSession((prev) => {
        const idx = Math.min(
          Math.max(0, prev.stepIndex),
          PRE_VISIT_QUESTION_STEPS.length - 1
        );
        const key = PRE_VISIT_QUESTION_STEPS[idx].key;
        const cur = String(prev.answers[key] ?? "").trim();
        return {
          ...prev,
          patientLanguage: prev.patientLanguage || readLocaleKey() || "de",
          answers: {
            ...prev.answers,
            [key]: cur ? `${cur} ${add}` : add,
          },
        };
      });
    },
    [useAdaptiveSymptoms]
  );

  return (
    <div className="pre-visit-chat">
      <div className="pre-visit-chat__inner">
        <PreVisitModuleChrome />

        <div className="pre-visit-chat__progress-wrap">
          <p
            className="pre-visit-chat__progress-label"
            id="previsit-progress-label"
          >
            {progressFromTemplate(
              tUi.progressTemplate,
              progressNum,
              total
            )}
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
            {tUi.sectionLabelQuestion}
          </p>
          <h1 className="pre-visit-chat__title">{title}</h1>
          <p className="pre-visit-chat__explanation">{explanation}</p>

          <PreVisitAudioToolbar
            speakText={speakText}
            patientLanguage={session.patientLanguage || readLocaleKey() || "de"}
            labels={tUi}
            onAppendTranscript={appendTranscript}
            disabled={useAdaptiveSymptoms && symptomsPanelBusy}
          />

          {useAdaptiveSymptoms ? (
            <SymptomsAdaptivePanel
              ref={adaptivePanelRef}
              session={session}
              setSession={setSession}
              labels={tUi}
              patientLanguage={session.patientLanguage}
              onExitStep={goBack}
              onFinished={handleSymptomsAdaptiveFinished}
              onBusyChange={handleSymptomsBusy}
            />
          ) : (
            <>
              <div className="pre-visit-chat__field">
                <label
                  className="pre-visit-chat__textarea-label"
                  htmlFor={`previsit-field-${step.key}`}
                >
                  {tUi.sectionLabelAnswer}
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
            </>
          )}
        </article>

        {import.meta.env.DEV ? (
          <div className="pre-visit-chat__dev-demo">
            <button
              type="button"
              className="pre-visit-chat__btn pre-visit-chat__btn--demo"
              onClick={insertDemoAndGoToReview}
            >
              {tUi.devInsertDemo}
            </button>
            <p className="pre-visit-chat__dev-note">
              {tUi.devOnlyNote}
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
