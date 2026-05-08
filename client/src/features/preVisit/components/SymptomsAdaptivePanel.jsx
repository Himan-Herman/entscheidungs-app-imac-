import { useCallback, useMemo, useState } from "react";
import {
  PREVISIT_SYMPTOMS_MAX_FOLLOWUPS,
  compileSymptomsDocumentation,
  createEmptySymptomsIntakeSlice,
  getOfflineFollowUpQuestion,
} from "../engine/symptomsAdaptiveEngine.js";

/**
 * Adaptive symptoms intake (bounded). Persists slice on `session.intakeV1.symptomsOwnWords`.
 */
export default function SymptomsAdaptivePanel({
  session,
  setSession,
  patientLanguage,
  labels,
  onFinished,
  onExitStep,
}) {
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const slice = useMemo(() => {
    const existing = session?.intakeV1?.symptomsOwnWords;
    if (existing && typeof existing === "object") return existing;
    return createEmptySymptomsIntakeSlice();
  }, [session?.intakeV1?.symptomsOwnWords]);

  const persistSlice = useCallback(
    (nextSlice) => {
      setSession((prev) => ({
        ...prev,
        patientLanguage: prev.patientLanguage || patientLanguage,
        intakeV1: {
          schemaVersion: 1,
          ...prev.intakeV1,
          symptomsOwnWords: nextSlice,
        },
      }));
    },
    [patientLanguage, setSession]
  );

  const applyServerOrFallback = useCallback(
    async (seed, qaHistory) => {
      if (qaHistory.length >= PREVISIT_SYMPTOMS_MAX_FOLLOWUPS) {
        return {
          done: true,
          followUpQuestion: null,
          completeness: 0.82,
        };
      }
      try {
        const res = await fetch("/api/previsit/symptoms-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientLanguage,
            seedStatement: seed,
            qaHistory,
            maxFollowUps: PREVISIT_SYMPTOMS_MAX_FOLLOWUPS,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "request_failed");
        }
        return {
          done: Boolean(data.done),
          followUpQuestion:
            data.followUpQuestion == null
              ? null
              : String(data.followUpQuestion).trim() || null,
          completeness: Number(data.completeness) || 0,
        };
      } catch {
        const idx = qaHistory.length;
        const q = getOfflineFollowUpQuestion(patientLanguage, idx);
        if (!q) {
          return { done: true, followUpQuestion: null, completeness: 0.75 };
        }
        return {
          done: false,
          followUpQuestion: q,
          completeness: 0.35 + idx * 0.12,
        };
      }
    },
    [patientLanguage]
  );

  const handleBack = useCallback(() => {
    setError("");
    const hist = Array.isArray(slice.qaHistory) ? [...slice.qaHistory] : [];
    if (hist.length > 0) {
      const last = hist.pop();
      persistSlice({
        ...slice,
        qaHistory: hist,
        currentQuestion: last.question,
        completeness: slice.completeness,
        status: "active",
      });
      setReplyDraft(last.answer || "");
      return;
    }
    if (slice.currentQuestion) {
      persistSlice({
        ...slice,
        currentQuestion: null,
        qaHistory: hist,
        completeness: slice.completeness,
        status: "active",
      });
      setReplyDraft("");
      return;
    }
    onExitStep();
  }, [onExitStep, persistSlice, slice]);

  const handleContinue = useCallback(async () => {
    setError("");
    const seed = String(slice.seedStatement || "").trim();
    const currentQ = slice.currentQuestion
      ? String(slice.currentQuestion).trim()
      : "";

    if (!currentQ) {
      if (!seed) {
        setError(labels.adaptiveSeedRequired);
        return;
      }
      setBusy(true);
      try {
        const qaHistory = Array.isArray(slice.qaHistory) ? slice.qaHistory : [];
        const out = await applyServerOrFallback(seed, qaHistory);
        if (out.done) {
          const compiled = compileSymptomsDocumentation(seed, qaHistory);
          persistSlice({
            ...slice,
            seedStatement: seed,
            qaHistory,
            currentQuestion: null,
            completeness: out.completeness,
            status: "complete",
          });
          onFinished(compiled);
          return;
        }
        persistSlice({
          ...slice,
          seedStatement: seed,
          qaHistory,
          currentQuestion: out.followUpQuestion,
          completeness: out.completeness,
          status: "active",
        });
        setReplyDraft("");
      } finally {
        setBusy(false);
      }
      return;
    }

    const reply = String(replyDraft || "").trim();
    if (!reply) {
      setError(labels.adaptiveAnswerRequired);
      return;
    }

    const nextHist = [
      ...(Array.isArray(slice.qaHistory) ? slice.qaHistory : []),
      { question: currentQ, answer: reply },
    ];

    setBusy(true);
    try {
      const out = await applyServerOrFallback(seed, nextHist);
      if (out.done) {
        const compiled = compileSymptomsDocumentation(seed, nextHist);
        persistSlice({
          ...slice,
          seedStatement: seed,
          qaHistory: nextHist,
          currentQuestion: null,
          completeness: out.completeness,
          status: "complete",
        });
        onFinished(compiled);
        return;
      }
      persistSlice({
        ...slice,
        seedStatement: seed,
        qaHistory: nextHist,
        currentQuestion: out.followUpQuestion,
        completeness: out.completeness,
        status: "active",
      });
      setReplyDraft("");
    } finally {
      setBusy(false);
    }
  }, [
    applyServerOrFallback,
    labels.adaptiveAnswerRequired,
    labels.adaptiveSeedRequired,
    onFinished,
    persistSlice,
    replyDraft,
    slice,
  ]);

  return (
    <>
      {slice.currentQuestion ? (
        <div className="pre-visit-adaptive__followup" role="region">
          <p className="pre-visit-adaptive__label">{labels.adaptiveFollowupLabel}</p>
          <p className="pre-visit-adaptive__question">{slice.currentQuestion}</p>
        </div>
      ) : (
        <p className="pre-visit-adaptive__hint">{labels.adaptiveSeedHint}</p>
      )}

      <div className="pre-visit-chat__field">
        <label
          className="pre-visit-chat__textarea-label"
          htmlFor={
            slice.currentQuestion ? "previsit-symptoms-reply" : "previsit-symptoms-seed"
          }
        >
          {labels.sectionLabelAnswer}
        </label>
        <textarea
          id={slice.currentQuestion ? "previsit-symptoms-reply" : "previsit-symptoms-seed"}
          className="pre-visit-chat__textarea"
          value={slice.currentQuestion ? replyDraft : slice.seedStatement || ""}
          onChange={(e) => {
            if (slice.currentQuestion) {
              setReplyDraft(e.target.value);
            } else {
              persistSlice({
                ...slice,
                seedStatement: e.target.value,
                qaHistory: slice.qaHistory || [],
                currentQuestion: slice.currentQuestion,
                completeness: slice.completeness,
                status: "active",
              });
            }
          }}
          placeholder={labels.answerPlaceholder}
          rows={slice.currentQuestion ? 5 : 6}
          autoComplete="off"
          disabled={busy}
        />
      </div>

      {error ? (
        <p className="pre-visit-adaptive__error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="pre-visit-adaptive__meta" aria-live="polite">
        {labels.adaptiveProgressMeta
          .replace("{{n}}", String(slice.qaHistory?.length || 0))
          .replace("{{max}}", String(PREVISIT_SYMPTOMS_MAX_FOLLOWUPS))}
      </p>

      <div className="pre-visit-chat__actions">
        <button
          type="button"
          className="pre-visit-chat__btn pre-visit-chat__btn--secondary"
          onClick={handleBack}
          disabled={busy}
        >
          {labels.back}
        </button>
        <button
          type="button"
          className="pre-visit-chat__btn pre-visit-chat__btn--primary"
          onClick={handleContinue}
          disabled={busy}
        >
          {busy ? labels.adaptiveBusy : labels.next}
        </button>
      </div>
    </>
  );
}
