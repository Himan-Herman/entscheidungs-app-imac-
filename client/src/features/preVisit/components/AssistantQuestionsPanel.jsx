import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api.js";
import {
  computeAssistantQuestionsFingerprint,
  isAssistantQuestionsFresh,
  loadPreVisitSession,
  normalizeAssistantQuestions,
  setAssistantQuestions,
  updateAssistantQuestionAnswer,
} from "../constants/preVisitSession.js";
import "../styles/AssistantQuestionsPanel.css";

export default function AssistantQuestionsPanel({
  session,
  setSession,
  patientLanguage,
  doctorLanguage,
  labels,
}) {
  const sectionId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNote, setSuccessNote] = useState(null);

  const assistantData = useMemo(
    () => normalizeAssistantQuestions(session?.assistantQuestions),
    [session?.assistantQuestions]
  );

  const isFresh = useMemo(
    () => isAssistantQuestionsFresh(session),
    [session]
  );

  const generateQuestions = useCallback(async () => {
    const latest = loadPreVisitSession();
    if (!latest?.answers) return;

    if (isAssistantQuestionsFresh(latest)) {
      setError(null);
      setSuccessNote(labels.successStatus);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessNote(null);

    try {
      const data = await apiFetch("/api/previsit/assistant-questions", {
        method: "POST",
        body: JSON.stringify({
          patientLanguage: latest.patientLanguage || patientLanguage,
          doctorLanguage: doctorLanguage,
          answers: latest.answers,
          caseTimeline: latest.caseTimeline || null,
          longitudinalSnippet:
            latest.longitudinalCase?.compactTimelineSnippet || null,
        }),
      });

      const next = setAssistantQuestions(
        {
          questions: Array.isArray(data?.questions) ? data.questions : [],
          safetyNotice: data?.safetyNotice,
        },
        latest
      );
      if (!next) throw new Error("invalid_shape");
      setSession(next);
      setSuccessNote(labels.successStatus);
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [doctorLanguage, labels.error, labels.successStatus, patientLanguage, setSession]);

  useEffect(() => {
    if (!assistantData?.items?.length) return;
    const fp = computeAssistantQuestionsFingerprint(session);
    if (assistantData.fingerprint === fp) return;
    setSuccessNote(null);
  }, [assistantData?.fingerprint, assistantData?.items?.length, session]);

  function handleAnswerChange(id, value) {
    const next = updateAssistantQuestionAnswer(id, value);
    if (next) setSession(next);
  }

  return (
    <section
      className="pre-visit-assistant-q"
      aria-labelledby={`${sectionId}-heading`}
    >
      <div className="pre-visit-assistant-q__header">
        <h2 id={`${sectionId}-heading`} className="pre-visit-assistant-q__title">
          {labels.sectionTitle}
        </h2>
        <p className="pre-visit-assistant-q__intro">{labels.intro}</p>
        <p className="pre-visit-assistant-q__note" role="note">
          {labels.noAiAnswersNote}
        </p>
      </div>

      <div className="pre-visit-assistant-q__actions">
        <button
          type="button"
          className="pre-visit-doc__btn pre-visit-doc__btn--create-ai pre-visit-assistant-q__generate"
          onClick={() => void generateQuestions()}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? labels.generating : labels.generateButton}
        </button>
        {loading ? (
          <p className="pre-visit-assistant-q__status" role="status" aria-live="polite">
            {labels.generating}
          </p>
        ) : null}
        {error ? (
          <p className="pre-visit-doc__ai-error" role="alert">
            {error}
          </p>
        ) : null}
        {successNote && isFresh ? (
          <p className="pre-visit-doc__ai-success-note" role="status">
            {successNote}
          </p>
        ) : null}
        {assistantData?.items?.length && !isFresh ? (
          <p className="pre-visit-assistant-q__stale" role="note">
            {labels.staleHint}
          </p>
        ) : null}
      </div>

      {assistantData?.safetyNotice ? (
        <p className="pre-visit-assistant-q__safety" role="note">
          {assistantData.safetyNotice}
        </p>
      ) : null}

      {assistantData?.items?.length ? (
        <ul className="pre-visit-assistant-q__grid" role="list">
          {assistantData.items.map((item, index) => {
            const answerId = `${sectionId}-answer-${item.id}`;
            const doctorHintId = `${sectionId}-doctor-${item.id}`;
            return (
              <li key={item.id} className="pre-visit-assistant-q__tile">
                <article
                  className="pre-visit-assistant-q__card"
                  aria-labelledby={`${sectionId}-q-${item.id}`}
                >
                  <p className="pre-visit-assistant-q__tile-meta">
                    {labels.questionCounter
                      .replace("{{current}}", String(index + 1))
                      .replace("{{total}}", String(assistantData.items.length))}
                  </p>
                  <h3
                    id={`${sectionId}-q-${item.id}`}
                    className="pre-visit-assistant-q__question"
                  >
                    {item.patientQuestion}
                  </h3>
                  <p
                    id={doctorHintId}
                    className="pre-visit-assistant-q__doctor-line"
                  >
                    <span className="pre-visit-assistant-q__doctor-label">
                      {labels.doctorVersionLabel}:
                    </span>{" "}
                    {item.doctorQuestion}
                  </p>
                  <div className="pre-visit-assistant-q__answer-field">
                    <label
                      className="pre-visit-assistant-q__answer-label"
                      htmlFor={answerId}
                    >
                      {labels.answerLabel}
                    </label>
                    <textarea
                      id={answerId}
                      className="pre-visit-assistant-q__textarea"
                      value={item.patientAnswer || ""}
                      onChange={(e) =>
                        handleAnswerChange(item.id, e.target.value)
                      }
                      placeholder={labels.answerPlaceholder}
                      rows={4}
                      aria-describedby={doctorHintId}
                      autoComplete="off"
                    />
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pre-visit-assistant-q__empty" role="status">
          {labels.emptyState}
        </p>
      )}
    </section>
  );
}
