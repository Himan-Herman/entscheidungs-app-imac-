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
  normalizeLongitudinalCase,
  PREVISIT_LOCALE_STORAGE_KEY,
  savePreVisitSession,
} from "../constants/preVisitSession.js";
import { authFetch } from "../../../api/authFetch.js";
import { detectDeviceType, sendPracticeAnalyticsEvent } from "../../../api/productAnalytics.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import PreVisitAudioToolbar from "../components/PreVisitAudioToolbar.jsx";
import AdaptiveIntakePanel from "../adaptive/AdaptiveIntakePanel.jsx";
import {
  createEmptyAdaptiveSlice,
} from "../adaptive/adaptiveSessionUtils.js";
import { isAdaptiveCategoryKey } from "../adaptive/adaptiveCategories.js";
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

  const fetchedCaseCompactRef = useRef("");
  useEffect(() => {
    const cid = session?.longitudinalCase?.caseId;
    if (!cid) return;
    if (String(session?.longitudinalCase?.compactTimelineSnippet || "").trim()) {
      fetchedCaseCompactRef.current = cid;
      return;
    }
    if (fetchedCaseCompactRef.current === cid) return;
    fetchedCaseCompactRef.current = cid;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(
          `/api/previsit/cases/${encodeURIComponent(cid)}/compact-intake-context`,
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled || !data.ok) return;
        setSession((prev) => {
          const norm = normalizeLongitudinalCase({
            ...(prev.longitudinalCase || {}),
            caseId: cid,
            caseTitle: String(data.caseTitle || prev.longitudinalCase?.caseTitle || ""),
            compactTimelineSnippet: String(data.snippet || ""),
          });
          if (!norm) return prev;
          return { ...prev, longitudinalCase: norm };
        });
      } catch {
        if (!cancelled) fetchedCaseCompactRef.current = "";
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    session?.longitudinalCase?.caseId,
    session?.longitudinalCase?.compactTimelineSnippet,
  ]);

  useEffect(() => {
    document.title = tUi.pageTitle;
  }, [tUi.pageTitle]);

  const total = PRE_VISIT_QUESTION_STEPS.length;
  const stepIndex = Math.min(Math.max(0, session.stepIndex), total - 1);
  const step = PRE_VISIT_QUESTION_STEPS[stepIndex];
  const currentValue = session.answers[step.key] ?? "";

  const useAdaptiveStep = isAdaptiveCategoryKey(step.key);

  useEffect(() => {
    if (!isAdaptiveCategoryKey(step.key)) return;
    if (session.intakeV1?.[step.key]) return;
    setSession((prev) => ({
      ...prev,
      intakeV1: {
        schemaVersion: 2,
        ...prev.intakeV1,
        [step.key]: createEmptyAdaptiveSlice(step.key),
      },
    }));
  }, [
    step.key,
    session.intakeV1,
  ]);

  const [adaptivePanelBusy, setAdaptivePanelBusy] = useState(false);
  const adaptivePanelRef = useRef(null);

  const handleAdaptiveBusy = useCallback((busy) => {
    setAdaptivePanelBusy(Boolean(busy));
  }, []);

  useEffect(() => {
    if (!useAdaptiveStep) setAdaptivePanelBusy(false);
  }, [useAdaptiveStep]);

  const adaptiveStartedRef = useRef(new Set());
  useEffect(() => {
    if (!useAdaptiveStep || !step?.key) return;
    if (adaptiveStartedRef.current.has(step.key)) return;
    adaptiveStartedRef.current.add(step.key);
    const qr =
      session?.practiceContext?.qrToken != null
        ? String(session.practiceContext.qrToken).trim()
        : "";
    void sendPracticeAnalyticsEvent({
      eventType: "previsit_adaptive_category_started",
      ...(qr ? { qrToken: qr } : {}),
      metadata: {
        adaptiveCategoryKey: step.key,
        flowStep: step.key,
        deviceType: detectDeviceType(),
        uiLanguage: language,
      },
    });
  }, [useAdaptiveStep, step.key, session?.practiceContext?.qrToken, language]);

  const handleAdaptiveFinished = useCallback(
    (compiled) => {
      const qr =
        session?.practiceContext?.qrToken != null
          ? String(session.practiceContext.qrToken).trim()
          : "";
      void sendPracticeAnalyticsEvent({
        eventType: "previsit_adaptive_category_completed",
        ...(qr ? { qrToken: qr } : {}),
        metadata: {
          adaptiveCategoryKey: step.key,
          flowStep: step.key,
          deviceType: detectDeviceType(),
          uiLanguage: language,
        },
      });
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
          answers: { ...prev.answers, [step.key]: compiled },
          intakeV1: {
            schemaVersion: 2,
            ...prev.intakeV1,
            [step.key]: {
              ...(prev.intakeV1?.[step.key] || createEmptyAdaptiveSlice(step.key)),
              status: "complete",
              currentQuestion: "",
              compiledAnswer: compiled,
            },
          },
          stepIndex: nextIdx,
        };
      });
    },
    [language, navigate, session?.practiceContext?.qrToken, step.key]
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
    if (prev?.longitudinalCase) next.longitudinalCase = prev.longitudinalCase;
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
    if (useAdaptiveStep) {
      const q = String(session.intakeV1?.[step.key]?.currentQuestion || "").trim();
      if (q) parts.push(q);
    }
    return parts.filter(Boolean).join("\n\n").slice(0, 1200);
  }, [
    title,
    explanation,
    useAdaptiveStep,
    session.intakeV1,
    step.key,
  ]);

  const appendTranscript = useCallback(
    (snippet) => {
      const add = String(snippet || "").trim();
      if (!add) return;
      if (useAdaptiveStep) {
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
    [useAdaptiveStep]
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
          {session?.longitudinalCase?.caseId ? (
            <p className="pre-visit-chat__longitudinal-note" role="note">
              {tUi.longitudinalCaseBanner}
            </p>
          ) : null}
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
            disabled={useAdaptiveStep && adaptivePanelBusy}
            qrToken={
              session?.practiceContext?.qrToken != null
                ? String(session.practiceContext.qrToken).trim()
                : ""
            }
          />

          {useAdaptiveStep ? (
            <AdaptiveIntakePanel
              ref={adaptivePanelRef}
              categoryKey={step.key}
              categoryTitle={title}
              session={session}
              setSession={setSession}
              labels={tUi}
              patientLanguage={session.patientLanguage}
              onExitStep={goBack}
              onSkipStep={goNext}
              onFinished={handleAdaptiveFinished}
              onBusyChange={handleAdaptiveBusy}
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
